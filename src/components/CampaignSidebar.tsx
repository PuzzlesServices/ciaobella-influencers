'use client';

import { Search, BookmarkCheck, BarChart2, Settings } from "lucide-react";
import Image from "next/image";

export type NavView = 'Search' | 'Saved' | 'Analytics' | 'Settings';

const NAV_ITEMS: { icon: React.ElementType; label: NavView }[] = [
  { icon: Search,        label: 'Search'    },
  { icon: BookmarkCheck, label: 'Saved'     },
  { icon: BarChart2,     label: 'Analytics' },
  { icon: Settings,      label: 'Settings'  },
];

interface Props {
  activeView: NavView;
  onNavigate: (view: NavView) => void;
}

const CampaignSidebar = ({ activeView, onNavigate }: Props) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border flex justify-center">
        <Image
          src="/logo-ciaobella.png"
          alt="Ciao Bella"
          width={100}
          height={48}
          className="object-contain"
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ icon: Icon, label }) => {
          const isActive = activeView === label;
          return (
            <button
              key={label}
              onClick={() => onNavigate(label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default CampaignSidebar;
