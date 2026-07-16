import { useState } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Building2, Users, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useDepartments } from "@/contexts/department-context";

export interface DashboardFiltersState {
  period: "today" | "week" | "month" | "custom";
  startDate: Date | undefined;
  endDate: Date | undefined;
  departmentId: string;
  userId: string;
  companyId: string;
}

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onFiltersChange: (filters: DashboardFiltersState) => void;
}

// Mock de empresas - será substituído por dados reais do backend
const mockCompanies = [
  { id: "1", name: "Empresa Alpha" },
  { id: "2", name: "Empresa Beta" },
  { id: "3", name: "Empresa Gamma" },
];

// Mock de usuários - será substituído por dados reais do backend
const mockUsers = [
  { id: "1", name: "João Silva", companyId: "1", departmentId: "1" },
  { id: "2", name: "Maria Santos", companyId: "1", departmentId: "2" },
  { id: "3", name: "Pedro Costa", companyId: "2", departmentId: "1" },
];

export function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const { user } = useAuth();
  const { getActiveDepartments } = useDepartments();
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  const isMaster = user?.role?.toLowerCase() === "master";
  const departments = getActiveDepartments();

  // Filtrar usuários por empresa e departamento selecionados
  const filteredUsers = mockUsers.filter((u) => {
    if (filters.companyId && u.companyId !== filters.companyId) return false;
    if (filters.departmentId && u.departmentId !== filters.departmentId) return false;
    return true;
  });

  const handlePeriodChange = (period: string) => {
    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (period) {
      case "today":
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 0 }); // Domingo
        endDate = endOfWeek(now, { weekStartsOn: 0 }); // Sábado
        break;
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "custom":
        // Mantém as datas anteriores ou undefined
        startDate = filters.startDate;
        endDate = filters.endDate;
        break;
    }

    onFiltersChange({
      ...filters,
      period: period as DashboardFiltersState["period"],
      startDate,
      endDate,
    });
  };

  const handleCustomDateChange = (type: "start" | "end", date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      period: "custom",
      [type === "start" ? "startDate" : "endDate"]: date,
    });
  };

  const formatDateRange = () => {
    if (!filters.startDate && !filters.endDate) return "Selecione o período";
    const start = filters.startDate ? format(filters.startDate, "dd/MM/yyyy", { locale: ptBR }) : "";
    const end = filters.endDate ? format(filters.endDate, "dd/MM/yyyy", { locale: ptBR }) : "";
    return `${start} - ${end}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filtros:
      </div>

      {/* Filtro de Empresa - Apenas para Master */}
      {isMaster && (
        <Select
          value={filters.companyId || "all"}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, companyId: value === "all" ? "" : value, userId: "" })
          }
        >
          <SelectTrigger className="w-[180px]">
            <Building2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {mockCompanies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Filtro de Período */}
      <Select value={filters.period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[160px]">
          <CalendarIcon className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="week">Esta semana</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {/* Seleção de Data Personalizada */}
      {filters.period === "custom" && (
        <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[260px] justify-start text-left font-normal",
                !filters.startDate && !filters.endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col sm:flex-row gap-2 p-3">
              <div>
                <p className="text-sm font-medium mb-2">Data Inicial</p>
                <Calendar
                  mode="single"
                  selected={filters.startDate}
                  onSelect={(date) => handleCustomDateChange("start", date)}
                  locale={ptBR}
                  initialFocus
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Data Final</p>
                <Calendar
                  mode="single"
                  selected={filters.endDate}
                  onSelect={(date) => handleCustomDateChange("end", date)}
                  locale={ptBR}
                  disabled={(date) =>
                    filters.startDate ? date < filters.startDate : false
                  }
                />
              </div>
            </div>
            <div className="p-3 border-t">
              <Button
                size="sm"
                className="w-full"
                onClick={() => setIsCustomDateOpen(false)}
              >
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Filtro de Departamento */}
      <Select
        value={filters.departmentId || "all"}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, departmentId: value === "all" ? "" : value, userId: "" })
        }
      >
        <SelectTrigger className="w-[180px]">
          <Briefcase className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Todos departamentos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos departamentos</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtro de Usuário */}
      <Select
        value={filters.userId || "all"}
        onValueChange={(value) => onFiltersChange({ ...filters, userId: value === "all" ? "" : value })}
      >
        <SelectTrigger className="w-[180px]">
          <Users className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Todos usuários" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos usuários</SelectItem>
          {filteredUsers.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
