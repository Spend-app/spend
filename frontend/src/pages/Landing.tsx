import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Logo } from "../components/AppShell";
import { Button } from "../components/ui";
import { useApp } from "../context/AppContext";

/** Each hero slide carries its own headline, copy and a generated product
 *  screenshot (see scripts/shot-templates + scripts/take-shots.sh) shown in a
 *  centered showcase. The dark branded backdrop stays as the base. */
const SLIDES = [
  {
    image: "/images/hero-dashboard.png",
    title: "Get cash from your Bitcoin, keep your coins.",
    text: "Borrow against your BTC in minutes without selling it. When you repay, the same coins you locked come back to you.",
  },
  {
    image: "/images/hero-borrow.png",
    title: "Use your money, keep your upside.",
    text: "Turn idle Bitcoin into everyday cash. Your coins stay yours — you're never selling them.",
  },
  {
    image: "/images/hero-position.png",
    title: "Buy what matters today.",
    text: "Stock for your shop, a repair that can't wait, a flight home. Borrow exactly what you need, from $10, and pay it back on your schedule.",
  },
  {
    image: "/images/hero-repay.png",
    title: "Liquidity for your business, not your balance sheet.",
    text: "Flexible small loans against your Bitcoin without selling it. No paperwork or intermediaries, repay any time.",
  },
  {
    image: "/images/hero-borrow.png",
    title: "Simple pricing, no surprises.",
    text: "4% a year in simple interest, calculated per second, plus a one-time 0.30% fee. No compounding, no hidden costs.",
  },
];

const AUTOPLAY_MS = 7000;

const FAQS = [
  {
    q: "Why would I borrow against my Bitcoin?",
    a: "You get cash to spend (MUSD, a digital dollar) while keeping your Bitcoin. Repay any time and the same BTC you locked comes back to you, so you never have to sell.",
  },
  {
    q: "What makes Spend different from borrowing on Mezo directly?",
    a: "Mezo requires a minimum of 1,800 MUSD per Trove. Spend is a layer on top of Mezo that runs a single trove and lends from it, so you can borrow small amounts. Loans start at $10.",
  },
  {
    q: "How does my Bitcoin stay safe?",
    a: "Your exact BTC quantity is deposited as collateral in Mezo's contracts. It is never sold or lent out, and the same quantity is returned to you in full when you repay.",
  },
  {
    q: "What does it cost?",
    a: "Simple interest of 4% a year on what you borrowed, calculated per second and never compounding, plus a one-time 0.30% fee when you open the loan.",
  },
  {
    q: "Can I repay early?",
    a: "Any time, with no penalty. Pay back the principal plus the interest accrued up to that second, and your loan is closed and your Bitcoin comes back.",
  },
];

/** Centered hero copy with a live app showcase rendered from generated
 *  screenshots (scripts/take-shots.sh). The showcase scales down responsively
 *  and the whole hero stays centered at every breakpoint. */
export default function Landing() {
  const navigate = useNavigate();
  const { connected, connect, isOwner, masterState } = useApp();
  const count = SLIDES.length;
  const [index, setIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Switch the header style once the user scrolls past the hero.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-advance the carousel. Re-created on every index change, so a manual
  // switch restarts the timer.
  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, [count, index]);

  // Once a wallet connects on the landing page, send it straight to the side
  // it belongs to: the admin side for the owner, the app side for everyone
  // else. Wait until the on-chain owner is known so the decision is accurate.
  useEffect(() => {
    if (!connected) return;
    if (!masterState.owner) return;
    navigate(isOwner ? "/admin" : "/app", { replace: true });
  }, [connected, isOwner, masterState.owner, navigate]);

  const openApp = () =>
    navigate(
      connected && masterState.owner ? (isOwner ? "/admin" : "/app") : "/app",
    );

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  const { title, text } = SLIDES[index];

  return (
    <div className="min-h-screen bg-white">
      {/* Header – transparent over the dark hero, frosted glass once scrolled */}
      <header
        className={`fixed inset-x-0 top-0 z-20 transition-all duration-300 ${
          scrolled
            ? "border-b border-line bg-white/90 backdrop-blur-md shadow-sm"
            : ""
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo light={!scrolled} />
          <Button
            onClick={() => (connected ? openApp() : connect())}
            className="px-5 py-2.5"
          >
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero carousel */}
      <section className="group relative flex min-h-screen items-center overflow-hidden bg-[#100d1f]">
        {/* Branded backdrop — layered gradients + a faint grid. Always on-brand,
            and the base that any real hero photo sits on top of. */}
        <div className="absolute inset-0">
          <div className="absolute -left-40 -top-48 h-[36rem] w-[36rem] rounded-full bg-primary/25 blur-[130px]" />
          <div className="absolute -bottom-40 right-0 h-[32rem] w-[32rem] rounded-full bg-[#f7931a]/10 blur-[130px]" />
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />
        </div>

        {/* Centered copy + live app showcase */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-20 pt-32 text-center sm:px-24 lg:px-5">
          <div key={index} className="max-w-3xl">
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/75">
              {text}
            </p>
            <div className="mt-9 flex justify-center">
              <Button
                onClick={() => (connected ? openApp() : connect())}
                className="px-7 py-3.5 text-base"
              >
                Get Started
              </Button>
            </div>
          </div>

          {/* Live app showcase */}
          <div className="relative mt-16 w-full max-w-4xl">
            <div className="absolute -inset-8 rounded-[2.5rem] bg-primary/25 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#17121f] shadow-2xl shadow-black/60">
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-5 py-3.5">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <div className="ml-4 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-center text-xs text-white/70">
                  Spend · Mezo
                </div>
              </div>
              <img
                key={SLIDES[index].image}
                src={SLIDES[index].image}
                alt="Spend app"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>

        {/* Carousel arrows, on the left and right edges. They fade in on hover
            (desktop) and disappear when there is nowhere to go. */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous slide"
          aria-hidden={index === 0}
          tabIndex={index === 0 ? -1 : 0}
          className={`absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur transition-all hover:bg-black/35 sm:h-11 sm:w-11 md:left-5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${
            index === 0 ? "hidden" : ""
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => go(1)}
          aria-label="Next slide"
          aria-hidden={index === count - 1}
          tabIndex={index === count - 1 ? -1 : 0}
          className={`absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur transition-all hover:bg-black/35 sm:h-11 sm:w-11 md:right-5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${
            index === count - 1 ? "hidden" : ""
          }`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Slide indicators */}
        <div className="absolute inset-x-0 bottom-8 z-20 flex items-center justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-8 bg-white"
                  : "w-4 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </section>

      {/* Questions & Answers */}
      <section className="border-t border-line bg-soft py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Questions
          </h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQS.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-mute transition-transform group-open:rotate-180" />
                </summary>
                <p className="max-w-2xl pb-5 text-mute">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Minimal footer */}
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
          <Logo compact />
          <p className="text-sm text-mute">© 2026 Spend · Built on Mezo</p>
        </div>
      </footer>
    </div>
  );
}
