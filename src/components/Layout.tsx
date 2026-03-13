import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Image as ImageIcon } from "lucide-react";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <ImageIcon className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-zinc-900">
                  项目实施助手
                </span>
              </div>
              <nav className="ml-6 flex space-x-8">
                <Link
                  to="/"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === "/" || location.pathname.startsWith("/editor")
                      ? "border-primary-500 text-zinc-900"
                      : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                  }`}
                >
                  模版选择
                </Link>
                <Link
                  to="/admin"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname.startsWith("/admin")
                      ? "border-primary-500 text-zinc-900"
                      : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  管理后台
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
