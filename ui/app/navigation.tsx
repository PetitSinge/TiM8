'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-context";

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠", color: "hover:text-sky-400" },
  { href: "/tim8", label: "TiM8", icon: "🧠", color: "hover:text-emerald-400" },
  { href: "/clusters", label: "Clusters", icon: "📡", color: "hover:text-blue-400" },
  { href: "/workspaces", label: "Workspaces", icon: "🏗️", color: "hover:text-violet-400" },
  { href: "/incidents", label: "Incidents", icon: "🔥", color: "hover:text-red-400" },
  { href: "/chaos", label: "Chaos Monkey", icon: "🧨", color: "hover:text-amber-400" },
  { href: "/settings", label: "Settings", icon: "⚙️", color: "hover:text-yellow-400" },
];

export default function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-glass border-r border-glass p-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
          🚀 TiM8
        </h1>
        
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-glass border-glass hover:bg-opacity-80 transition-all focus-ring"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col space-y-2">
        {navItems.map(({ href, label, icon, color }) => (
          <Link
            key={href}
            href={href}
            className={`
              flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-ring
              ${isActive(href)
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : `text-secondary hover:bg-glass ${color} hover:translate-x-1`
              }
            `}
          >
            <span className="text-lg">{icon}</span>
            <span>{label}</span>
            {isActive(href) && (
              <div className="ml-auto w-2 h-2 rounded-full bg-sky-400"></div>
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="text-xs text-muted text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
            <span>System Online</span>
          </div>
          <p>DevOps Incident Co-Pilot</p>
        </div>
      </div>
    </aside>
  );
}