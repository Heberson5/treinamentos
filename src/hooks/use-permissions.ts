import { useEffect, useState, useCallback } from "react";
import { useAuth, TipoRole } from "@/contexts/auth-context";
import { supabase } from "@/integrations/supabase/client";

/**
 * Permissões padrão por papel (fallback quando a empresa ainda não personalizou).
 * Persistidas no banco (tabela `permissoes_role`) quando o Master/Admin salva
 * alterações em /admin/permissoes.
 *
 * Permissões sensíveis (controladas pelo Master):
 * - trainings.upload_video → Permite o upload de arquivo de vídeo. Quando ausente,
 *   o usuário só pode informar o link (YouTube/URL externa).
 */
const PERMISSOES_PADRAO: Record<TipoRole, string[]> = {
  master: ["*"],
  admin: [
    "trainings.view",
    "trainings.create",
    "trainings.edit",
    "trainings.delete",
    "trainings.manage",
    "trainings.assign",
    "trainings.certificates",
    "catalog.view",
    "catalog.manage",
    "users.view",
    "users.create",
    "users.edit",
    "users.delete",
    "users.roles",
    "users.import",
    "users.progress",
    "users.manage",
    "reports.view",
    "reports.export",
    "reports.advanced",
    "reports.department",
    "reports.compliance",
    "departments.view",
    "departments.create",
    "departments.edit",
    "departments.delete",
    "integrations.view",
    "integrations.configure",
    "integrations.ai",
    "system.settings",
    "system.notifications",
    "popups.manage",
    // upload de vídeo NÃO incluído por padrão — Master concede
  ],
  instrutor: [
    "trainings.view",
    "trainings.create",
    "trainings.edit",
    "trainings.assign",
    "trainings.certificates",
    "catalog.view",
    "users.view",
    "users.progress",
    "reports.view",
    "reports.export",
    "reports.department",
    "departments.view",
    "integrations.ai",
  ],
  usuario: ["trainings.view", "catalog.view"],
};

// Cache compartilhado por empresa para evitar requisições repetidas.
const cache = new Map<string, Record<TipoRole, Set<string>>>();
const cacheListeners = new Set<() => void>();

function cacheKey(empresaId: string | null | undefined) {
  return empresaId ?? "__global__";
}

function notifyCacheListeners() {
  cacheListeners.forEach((cb) => cb());
}

async function carregarPermissoesEmpresa(empresaId: string | null | undefined) {
  const key = cacheKey(empresaId);
  if (cache.has(key)) return cache.get(key)!;

  // Inicia com o padrão
  const mapa: Record<TipoRole, Set<string>> = {
    master: new Set(PERMISSOES_PADRAO.master),
    admin: new Set(PERMISSOES_PADRAO.admin),
    instrutor: new Set(PERMISSOES_PADRAO.instrutor),
    usuario: new Set(PERMISSOES_PADRAO.usuario),
  };

  try {
    let query = supabase.from("permissoes_role").select("role, permissao_id, ativo");
    if (empresaId) {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    } else {
      query = query.is("empresa_id", null);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[usePermissions] falha ao carregar permissoes_role:", error.message);
      cache.set(key, mapa);
      return mapa;
    }

    if (data && data.length > 0) {
      // Quando há registros customizados, eles SOBRESCREVEM o padrão por papel.
      const rolesCustomizados = new Set<TipoRole>();
      data.forEach((row) => rolesCustomizados.add(row.role as TipoRole));
      rolesCustomizados.forEach((r) => {
        if (r !== "master") mapa[r] = new Set();
      });
      data.forEach((row) => {
        const r = row.role as TipoRole;
        if (r === "master") return; // master é sempre tudo
        if (row.ativo) mapa[r].add(row.permissao_id);
      });
    }
  } catch (err) {
    console.warn("[usePermissions] erro inesperado:", err);
  }

  cache.set(key, mapa);
  return mapa;
}

export function invalidatePermissionsCache(empresaId?: string | null) {
  if (empresaId === undefined) {
    cache.clear();
  } else {
    cache.delete(cacheKey(empresaId));
  }
  notifyCacheListeners();
}

export function usePermissions() {
  const { user } = useAuth();
  const role: TipoRole = user?.role ?? "usuario";
  const empresaId = (user as any)?.empresa_id ?? null;

  const [, force] = useState(0);
  const [permissoes, setPermissoes] = useState<Set<string>>(
    () => new Set(PERMISSOES_PADRAO[role] ?? [])
  );

  useEffect(() => {
    let cancelado = false;
    carregarPermissoesEmpresa(empresaId).then((mapa) => {
      if (!cancelado) setPermissoes(mapa[role] ?? new Set());
    });

    const listener = () => {
      carregarPermissoesEmpresa(empresaId).then((mapa) => {
        if (!cancelado) {
          setPermissoes(mapa[role] ?? new Set());
          force((n) => n + 1);
        }
      });
    };
    cacheListeners.add(listener);
    return () => {
      cancelado = true;
      cacheListeners.delete(listener);
    };
  }, [empresaId, role]);

  const has = useCallback(
    (permissionId: string): boolean => {
      if (!user) return false;
      if (role === "master") return true;
      return permissoes.has("*") || permissoes.has(permissionId);
    },
    [user, role, permissoes]
  );

  return {
    role,
    has,
    canUploadVideo: role === "master" || permissoes.has("*") || permissoes.has("trainings.upload_video"),
    isMaster: role === "master",
  };
}
