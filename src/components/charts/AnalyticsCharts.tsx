import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts"

interface EngagementData {
  dia: string
  visualizacoes: number
  interacoes: number
  conclusoes: number
}

interface DepartmentData {
  nome: string
  usuarios: number
  conclusoes: number
  engajamento: number
}

interface TrainingData {
  titulo: string
  conclusoes: number
  taxa: number
}

interface MonthlyData {
  mes: string
  iniciados: number
  concluidos: number
  certificados?: number
}

const COLORS = ['hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(217, 91%, 60%)', 'hsl(280, 67%, 51%)', 'hsl(38, 92%, 50%)']

export function WeeklyEngagementChart({ data }: { data: EngagementData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade Semanal</CardTitle>
        <CardDescription>Visualizações, interações e conclusões por dia</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="dia" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="visualizacoes" name="Visualizações" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="interacoes" name="Interações" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="conclusoes" name="Conclusões" fill="hsl(280, 67%, 51%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function DepartmentEngagementChart({ data }: { data: DepartmentData[] }) {
  const isMobile = useIsMobile()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engajamento por Departamento</CardTitle>
        <CardDescription>Taxa de engajamento por área</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 20, right: 20, left: isMobile ? 8 : 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" domain={[0, 100]} className="text-xs" />
            <YAxis dataKey="nome" type="category" className="text-xs" width={isMobile ? 56 : 70} tick={{ fontSize: isMobile ? 9 : 12 }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`${value}%`, 'Engajamento']}
            />
            <Bar dataKey="engajamento" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TrainingPerformanceChart({ data }: { data: TrainingData[] }) {
  const isMobile = useIsMobile()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance dos Treinamentos</CardTitle>
        <CardDescription>Taxa de conclusão por treinamento</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.slice(0, isMobile ? 3 : 5)} margin={{ top: 20, right: 10, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="titulo"
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fontSize: isMobile ? 8 : 10 }}
            />
            <YAxis className="text-xs" domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`${value}%`, 'Taxa de Conclusão']}
            />
            <Bar dataKey="taxa" name="Taxa de Conclusão" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function MonthlyProgressChart({ data }: { data: MonthlyData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Mensal</CardTitle>
        <CardDescription>Progresso dos treinamentos ao longo do tempo</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorIniciados" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorConcluidos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="mes" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="iniciados" 
              name="Iniciados"
              stroke="hsl(217, 91%, 60%)" 
              fillOpacity={1} 
              fill="url(#colorIniciados)" 
            />
            <Area 
              type="monotone" 
              dataKey="concluidos" 
              name="Concluídos"
              stroke="hsl(142, 76%, 36%)" 
              fillOpacity={1} 
              fill="url(#colorConcluidos)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function DistributionPieChart({ data, title, description }: { 
  data: { name: string; value: number }[]
  title: string
  description: string 
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TrendLineChart({ data, dataKey, name, color = "hsl(var(--primary))" }: { 
  data: any[]
  dataKey: string
  name: string
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" className="text-xs" hide />
        <YAxis className="text-xs" hide />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          name={name}
          stroke={color} 
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ComparisonBarChart({ data }: { data: { name: string; atual: number; anterior: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativo de Períodos</CardTitle>
        <CardDescription>Período atual vs anterior</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="atual" name="Período Atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="anterior" name="Período Anterior" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
