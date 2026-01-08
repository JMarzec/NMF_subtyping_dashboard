import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SubtypeDistributionProps {
  subtypeCounts: Record<string, number>;
}

const SUBTYPE_COLORS = [
  "hsl(221, 83%, 53%)",  // Blue
  "hsl(262, 83%, 58%)",  // Purple
  "hsl(142, 71%, 45%)",  // Green
  "hsl(24, 95%, 53%)",   // Orange
];

const SUBTYPE_LABELS: Record<string, string> = {
  "Subtype_1": "Proliferative",
  "Subtype_2": "Epithelial",
  "Subtype_3": "Mesenchymal",
  "Subtype_4": "Immune",
};

export const SubtypeDistribution = ({ subtypeCounts }: SubtypeDistributionProps) => {
  const data = Object.entries(subtypeCounts).map(([key, value], index) => ({
    name: SUBTYPE_LABELS[key] || key,
    value,
    color: SUBTYPE_COLORS[index % SUBTYPE_COLORS.length],
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Subtype Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, "Samples"]}
              />
              <Legend
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
