import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

/** Fond blanc + grande carte blanche arrondie contenant tout le site public. */
export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="page-bg min-h-screen p-2 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1360px] overflow-clip rounded-3xl bg-white shadow-soft">
        <Navbar />
        <main key={pathname} className="animate-page">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
