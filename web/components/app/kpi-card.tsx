import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  tone = "neutral",
  isCurrency = true,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "negative";
  isCurrency?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          "tabular text-2xl font-semibold",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {isCurrency ? formatCurrency(value) : value.toLocaleString()}
      </CardContent>
    </Card>
  );
}
