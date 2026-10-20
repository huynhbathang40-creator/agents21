import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { SetupBanner } from "./components/SetupBanner";
import { TrendingView } from "./components/TrendingView";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-neutral-900 focus:ring-2 focus:ring-indigo-600"
      >
        Skip to content
      </a>
      <Header />
      <SetupBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 focus:outline-none sm:px-6">
        <TrendingView />
      </main>
      <Footer />
    </div>
  );
}
