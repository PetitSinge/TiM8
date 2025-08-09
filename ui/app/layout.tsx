import "./globals.css";
import { ThemeProvider } from "./theme-context";
import Navigation from "./navigation";

export const metadata = {
  title: "TiM8",
  description: "Your DevOps Incident Co-Pilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <div className="min-h-screen flex">
            <Navigation />
            <main className="flex-1 p-8 overflow-y-auto">
              <div className="animate-fade-in">
                {children}
              </div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}