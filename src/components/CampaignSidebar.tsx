import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const styles = ["Minimalist", "Luxury", "Handmade"];

const CampaignSidebar = () => {
  const [budget, setBudget] = useState([1500]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Minimalist"]);

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  return (
    <aside className="w-72 flex-shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <h2 className="text-base font-semibold text-sidebar-foreground">Campaign Settings</h2>
        </div>

        {/* Compensation Type */}
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Compensation Type
          </label>
          <Select defaultValue="mixed">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gifting">Product Gifting</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Budget Slider */}
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Max Budget
          </label>
          <div className="mt-3">
            <Slider
              value={budget}
              onValueChange={setBudget}
              max={5000}
              min={100}
              step={100}
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-muted-foreground">$100</span>
              <span className="text-sm font-semibold text-foreground">${budget[0].toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">$5,000</span>
            </div>
          </div>
        </div>

        {/* Jewelry Style Chips */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
            Jewelry Style
          </label>
          <div className="flex flex-wrap gap-2">
            {styles.map((style) => {
              const active = selectedStyles.includes(style);
              return (
                <button
                  key={style}
                  onClick={() => toggleStyle(style)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default CampaignSidebar;
