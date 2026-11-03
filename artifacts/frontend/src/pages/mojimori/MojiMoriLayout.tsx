import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CircleUserRound, Grip, Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link, useLocation, useSearch } from "wouter";
import { NavigationMenu as NavigationMenuParts } from "@animate-ui/react/primitives/radix-ui";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../../components/ui/navigation-menu";
import { useTranslation } from "../../i18n/I18nProvider";
import { setColorScheme } from "../../theme";
import { MOJI_MORI_LEVEL_BANDS } from "../../lib/mojiMori";
import mojiMoriLogo from "./mojimori-logo.svg";
import "./mojimori.css";

const NAV_EASE = [0.22, 1, 0.36, 1] as const;
const NAV_SECONDS = 0.3;

const TYPE_MENUS = [
  {
    href: "/mojimori/radicals",
    label: "mojimori.nav.radicals",
    type: "radical",
  },
  { href: "/mojimori/kanji", label: "mojimori.nav.kanji", type: "kanji" },
  {
    href: "/mojimori/vocabulary",
    label: "mojimori.nav.vocabulary",
    type: "vocabulary",
  },
] as const;

type Pill = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  visible: boolean;
  snap: boolean;
};

const HIDDEN_PILL: Pill = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  color: "rgba(248, 180, 180, 0.28)",
  visible: false,
  snap: true,
};

function mixHex(hex: string, alpha: number) {
  const raw = hex.trim().replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  const value = Number.parseInt(full, 16);
  if (!/^[0-9a-f]{6}$/i.test(full) || Number.isNaN(value)) return null;
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

const mixedColors = new Map<string, string | null>();
let colorProbe: CanvasRenderingContext2D | null = null;

function mixColor(color: string, alpha: number) {
  const raw = color.trim();
  const key = `${raw}@${alpha}`;
  const cached = mixedColors.get(key);
  if (cached !== undefined) return cached;
  const hex = mixHex(raw, alpha);
  if (hex) {
    mixedColors.set(key, hex);
    return hex;
  }
  if (!colorProbe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorProbe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!colorProbe) return null;
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = "rgba(0,0,0,0)";
  colorProbe.fillStyle = raw;
  if (colorProbe.fillStyle === "rgba(0,0,0,0)") {
    mixedColors.set(key, null);
    return null;
  }
  colorProbe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorProbe.getImageData(0, 0, 1, 1).data;
  const mixed = a === 0 ? null : `rgba(${r}, ${g}, ${b}, ${alpha})`;
  mixedColors.set(key, mixed);
  return mixed;
}

function accentOf(trigger: HTMLElement) {
  const type = trigger.dataset.type;
  if (type === "search") return "rgba(47, 126, 184, 0.16)";
  if (type === "radical" || type === "kanji" || type === "vocabulary") {
    const color = getComputedStyle(trigger).getPropertyValue(`--color-${type}`);
    const alpha = type === "vocabulary" ? 0.28 : 0.22;
    return mixColor(color, alpha) ?? HIDDEN_PILL.color;
  }
  return HIDDEN_PILL.color;
}

function measurePill(
  trigger: HTMLElement,
  track: HTMLElement,
  snap: boolean,
): Pill {
  const trackBox = track.getBoundingClientRect();
  const box = trigger.getBoundingClientRect();
  return {
    x: box.left - trackBox.left,
    y: box.top - trackBox.top,
    width: box.width,
    height: box.height,
    color: accentOf(trigger),
    visible: true,
    snap,
  };
}

function TypeBandMenu({
  href,
  label,
  type,
  onHover,
  onNavigate,
  lit = false,
}: {
  href: string;
  label: string;
  type: (typeof TYPE_MENUS)[number]["type"];
  onHover: (trigger: HTMLElement) => void;
  onNavigate: () => void;
  lit?: boolean;
}) {
  const { t } = useTranslation();
  const [path] = useLocation();
  const bandKey = new URLSearchParams(useSearch()).get("band");
  const active = path === href || path.startsWith(`${href}/`);

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        data-type={type}
        className={`moji-nav-link${active ? " is-active" : ""}${lit ? " is-lit" : ""}`}
        onPointerEnter={(event: PointerEvent<HTMLButtonElement>) =>
          onHover(event.currentTarget)
        }
      >
        {t(label)}
      </NavigationMenuTrigger>
      <NavigationMenuContent className="moji-band-menu" data-type={type}>
        {MOJI_MORI_LEVEL_BANDS.map((band) => {
          const current =
            path === href &&
            (bandKey ? bandKey === band.key : band.key === "pleasant");
          const start = String(band.start).padStart(2, "0");
          const end = String(band.end).padStart(2, "0");
          return (
            <Link
              key={band.key}
              href={`${href}?band=${band.key}`}
              className={`moji-band-item${current ? " is-current" : ""}`}
              onClick={onNavigate}
            >
              <span className="moji-band-item__title">
                <span className="moji-band-item__mark">{band.ja}</span>
                {t(`mojimori.bands.${band.key}`)}
              </span>
              <span className="moji-band-item__range">
                {t("mojimori.nav.levels")} {start}-{end}
              </span>
            </Link>
          );
        })}
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

type MobileSection = "levels" | "radical" | "kanji" | "vocabulary" | "account";

const SECTION_MARK: Record<Exclude<MobileSection, "account">, string> = {
  levels: "レベル",
  radical: "部首",
  kanji: "漢字",
  vocabulary: "単語",
};

function MojiMobileNav({
  dark,
  onToggleTheme,
  layerRef,
  onMenuActive,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  layerRef: RefObject<HTMLDivElement | null>;
  onMenuActive: (active: boolean) => void;
}) {
  const { t } = useTranslation();
  const [path, navigate] = useLocation();
  const search = useSearch();
  const bandKey = new URLSearchParams(search).get("band");
  const [menuOn, setMenuOn] = useState(false);
  const [menuPhase, setMenuPhase] = useState<"closed" | "open" | "closing">("closed");
  const [section, setSection] = useState<MobileSection | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentLevel = Number(
    path.match(/^\/mojimori\/levels\/(\d+)(?:\/|$)/)?.[1] ?? 0,
  );
  const themeLabel = dark
    ? t("mojimori.nav.themeLight")
    : t("mojimori.nav.themeDark");
  const ThemeIcon = dark ? Sun : Moon;
  const menuActive = menuPhase !== "closed";

  useEffect(() => {
    setMenuOn(false);
    setMenuPhase("closed");
    setSearchOpen(false);
  }, [path, search]);

  useEffect(() => {
    onMenuActive(menuPhase !== "closed");
  }, [menuPhase, onMenuActive]);

  function openMenu() {
    setSearchDraft("");
    setSearchOpen(false);
    setMenuOn(true);
    setMenuPhase("closed");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMenuPhase("open"));
    });
  }

  function closeMenu() {
    setMenuPhase((phase) => (phase === "open" ? "closing" : phase));
  }

  useEffect(() => {
    if (!searchOpen) return;
    inputRef.current?.focus();
    const close = (event: Event) => {
      if (!formRef.current?.contains(event.target as Node)) {
        setSearchDraft("");
        setSearchOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchDraft("");
        setSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (menuPhase !== "open") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuPhase]);

  useEffect(() => {
    if (menuPhase !== "closing") return;
    const timer = window.setTimeout(() => {
      setMenuOn(false);
      setMenuPhase("closed");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [menuPhase]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = searchDraft.trim();
    if (!query) return;
    navigate(`/mojimori/search?q=${encodeURIComponent(query)}`);
    setSearchDraft("");
    setSearchOpen(false);
  }

  function toggleSection(next: MobileSection) {
    setSection((current) => (current === next ? null : next));
  }

  return (
    <div className="moji-mobile-tools">
      <form
        ref={formRef}
        className={`moji-mobile-search${menuActive ? " is-theme" : ""}${!menuActive && searchOpen ? " is-open" : ""}${searchDraft.trim() ? " has-query" : ""}`}
        onSubmit={submitSearch}
      >
        <input
          ref={inputRef}
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder={t("mojimori.searchPlaceholder")}
          aria-label={t("mojimori.nav.search")}
          className="moji-mobile-search__input"
          tabIndex={searchOpen ? 0 : -1}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <button
          type={!menuActive && searchOpen && searchDraft.trim() ? "submit" : "button"}
          className="moji-mobile-search__go"
          aria-label={menuActive ? themeLabel : t("mojimori.nav.search")}
          aria-expanded={searchOpen}
          onClick={() => {
            if (menuActive) {
              onToggleTheme();
              return;
            }
            if (searchOpen) return;
            closeMenu();
            setSearchOpen(true);
          }}
        >
          <svg
            className="moji-mobile-search__icon moji-mobile-search__icon--search"
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <svg
            className="moji-mobile-search__icon moji-mobile-search__icon--go"
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          <ThemeIcon className="moji-mobile-search__icon moji-mobile-search__icon--theme" size={18} aria-hidden="true" />
        </button>
      </form>
      <button
        type="button"
        className={`moji-mobile-menu-btn${menuPhase !== "closed" ? " is-open" : ""}`}
        aria-label={t("a11y.menu")}
        aria-expanded={menuPhase === "open"}
        onClick={() => {
          if (menuPhase === "open") closeMenu();
          else if (menuPhase === "closed") openMenu();
        }}
      >
        <Grip className="moji-mobile-menu-btn__grip" size={18} aria-hidden="true" />
        <svg
          className="moji-mobile-menu-btn__close"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <path d="M7.5 7.5L9.5 9.5" />
          <path d="M16.5 7.5L14.5 9.5" />
          <path d="M7.5 16.5L9.5 14.5" />
          <path d="M16.5 16.5L14.5 14.5" />
          <circle cx="5" cy="5" r="1" />
          <circle cx="19" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="5" cy="19" r="1" />
          <circle cx="19" cy="19" r="1" />
        </svg>
      </button>
      {menuOn
        ? createPortal(
          <nav className={`moji-mobile-menu${menuPhase === "open" ? " is-open" : ""}`}>
            {(["levels", "radical", "kanji", "vocabulary"] as const).map((key) => {
              const open = section === key;
              const label =
                key === "levels"
                  ? t("mojimori.nav.levels")
                  : t(`mojimori.nav.${key === "radical" ? "radicals" : key}`);
              return (
                <section
                  key={key}
                  className={`moji-mobile-section${open ? " is-open" : ""}`}
                  data-type={key}
                >
                  <button
                    type="button"
                    className="moji-mobile-section__toggle"
                    aria-expanded={open}
                    onClick={() => toggleSection(key)}
                  >
                    <span className="moji-mobile-section__mark">{SECTION_MARK[key]}</span>
                    <span>{label}</span>
                    <ChevronDown size={16} className="moji-mobile-section__chevron" />
                  </button>
                  <div className="moji-mobile-section__body">
                    <div>
                      {key === "levels" ? (
                        <div className="moji-mobile-groups">
                          {MOJI_MORI_LEVEL_BANDS.map((band) => (
                            <div key={band.key} className="moji-mobile-group">
                              <p className="moji-mobile-group__title">
                                <span>{band.ja}</span>
                                {t(`mojimori.bands.${band.key}`)}
                              </p>
                              <div className="moji-mobile-nums">
                                {Array.from(
                                  { length: band.end - band.start + 1 },
                                  (_, index) => band.start + index,
                                ).map((level) => (
                                  <Link
                                    key={level}
                                    href={`/mojimori/levels/${level}`}
                                    className={`moji-level-num${currentLevel === level ? " is-current" : ""}`}
                                    onClick={() => setMenuOn(false)}
                                  >
                                    {String(level).padStart(2, "0")}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="moji-mobile-links">
                          {MOJI_MORI_LEVEL_BANDS.map((band) => {
                            const href = `/mojimori/${key === "radical" ? "radicals" : key}`;
                            const current =
                              path === href &&
                              (bandKey ? bandKey === band.key : band.key === "pleasant");
                            const start = String(band.start).padStart(2, "0");
                            const end = String(band.end).padStart(2, "0");
                            return (
                              <Link
                                key={band.key}
                                href={`${href}?band=${band.key}`}
                                className={`moji-mobile-link${current ? " is-current" : ""}`}
                                onClick={() => setMenuOn(false)}
                              >
                                <span className="moji-mobile-link__title">
                                  <span className="moji-mobile-link__mark">{band.ja}</span>
                                  {t(`mojimori.bands.${band.key}`)}
                                </span>
                                <span className="moji-mobile-link__range">
                                  {t("mojimori.nav.levels")} {start}-{end}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
            <section
              className={`moji-mobile-section moji-mobile-section--account${section === "account" ? " is-open" : ""}`}
            >
              <button
                type="button"
                className="moji-mobile-section__toggle"
                aria-expanded={section === "account"}
                onClick={() => toggleSection("account")}
              >
                <CircleUserRound size={18} />
                <span>{t("mojimori.nav.account")}</span>
                <ChevronDown size={16} className="moji-mobile-section__chevron" />
              </button>
              <div className="moji-mobile-section__body">
                <div>
                  <div className="moji-mobile-links">
                    <Link
                      href="/mojimori/settings"
                      className="moji-mobile-link"
                      onClick={() => setMenuOn(false)}
                    >
                      <span className="moji-mobile-link__title">
                        {t("mojimori.nav.settings")}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </nav>,
          layerRef.current ?? document.body,
        )
        : null}
    </div>
  );
}

export function MojiMoriLayout({
  children,
  showHeader = true,
}: {
  children: ReactNode;
  showHeader?: boolean;
}) {
  const { t } = useTranslation();
  const [path, navigate] = useLocation();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef<HTMLElement | null>(null);
  const seenRef = useRef(false);
  const [menuValue, setMenuValue] = useState("");
  const [pill, setPill] = useState<Pill>(HIDDEN_PILL);
  const [litId, setLitId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const searchFormRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [floatUserMenu, setFloatUserMenu] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const levelsActive =
    path === "/mojimori/levels" || path.startsWith("/mojimori/levels/");
  const currentLevel = Number(
    path.match(/^\/mojimori\/levels\/(\d+)(?:\/|$)/)?.[1] ?? 0,
  );

  function hoverTrigger(trigger: HTMLElement) {
    if (hoveredRef.current === trigger) return;
    const track = trackRef.current;
    if (!track) return;
    const snap = !seenRef.current;
    seenRef.current = true;
    hoveredRef.current = trigger;
    setLitId(trigger.dataset.type ?? "levels");
    setPill(measurePill(trigger, track, snap));
  }

  function hidePill() {
    hoveredRef.current = null;
    setLitId(null);
    setPill((current) => ({ ...current, visible: false, snap: false }));
  }

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    setColorScheme(dark ? "light" : "dark");
  }

  const themeLabel = dark
    ? t("mojimori.nav.themeLight")
    : t("mojimori.nav.themeDark");
  const ThemeIcon = dark ? Sun : Moon;

  useEffect(() => {
    const nav = navRef.current;
    const header = headerRef.current;
    const root = rootRef.current;
    if (!showHeader || !nav || !header || !root) return;
    const apply = () => {
      const measured = nav.getBoundingClientRect().height;
      const height = measured > 0 ? `${measured}px` : "2.75rem";
      header.style.setProperty("--nav-bar-h", height);
      root.style.setProperty("--nav-bar-h", height);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [showHeader]);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (scrolled) setFloatUserMenu("");
    else if (menuValue === "user") setMenuValue("");
  }, [scrolled, menuValue]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const closeSearch = () => {
      setSearchDraft("");
      setSearchOpen(false);
    };
    const onPointer = (event: Event) => {
      if (!searchFormRef.current?.contains(event.target as Node)) {
        closeSearch();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSearch();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = searchDraft.trim();
    if (!query) return;
    navigate(`/mojimori/search?q=${encodeURIComponent(query)}`);
    setSearchDraft("");
    setSearchOpen(false);
  }

  useEffect(() => {
    const trigger = hoveredRef.current;
    const track = trackRef.current;
    if (!trigger || !track) return;
    const timer = window.setTimeout(() => {
      if (hoveredRef.current !== trigger || !trackRef.current) return;
      setPill(measurePill(trigger, trackRef.current, true));
    }, 520);
    return () => window.clearTimeout(timer);
  }, [scrolled]);

  const move = pill.snap || reduceMotion ? 0 : NAV_SECONDS;

  return (
    <div
      ref={rootRef}
      className={`moji-mori min-h-dvh${showHeader ? "" : " is-bare"}`}
    >
      {showHeader ? (
      <header
        ref={headerRef}
        className={`moji-header${scrolled ? " is-scrolled" : ""}${mobileMenu ? " is-menu-open" : ""}`}
      >
        <Link href="/mojimori" className="moji-float-logo nav-side">
          <span className="moji-mark">
            <img src={mojiMoriLogo} alt="" />
          </span>
          <span className="moji-brand">{t("mojimori.brand")}</span>
        </Link>
        <div ref={navRef} className="moji-float-nav">
          <NavigationMenu
            viewport={false}
            value={menuValue}
            onValueChange={setMenuValue}
            className="moji-nav z-20 max-w-none flex-none justify-center"
          >
            <div
              ref={trackRef}
              className="moji-nav-track"
              onPointerLeave={hidePill}
            >
              <motion.span
                className="moji-nav-indicator"
                initial={false}
                animate={{
                  x: pill.x,
                  y: pill.y,
                  width: pill.width,
                  height: pill.height,
                  opacity: pill.visible ? 1 : 0,
                  backgroundColor: pill.color,
                }}
                transition={{
                  duration: move,
                  ease: NAV_EASE,
                }}
              />
              <NavigationMenuList className="relative flex-nowrap items-center justify-center">
                <NavigationMenuItem
                  className="nav-slot"
                  inert={scrolled ? undefined : true}
                >
                  <Link
                    href="/mojimori"
                    data-type="logo"
                    className={`moji-nav-link moji-slot-logo${path === "/mojimori" ? " is-active" : ""}${litId === "logo" ? " is-lit" : ""}`}
                    tabIndex={scrolled ? 0 : -1}
                    aria-label={t("mojimori.brand")}
                    onPointerEnter={(event) => {
                      setMenuValue("");
                      hoverTrigger(event.currentTarget);
                    }}
                  >
                    <img src={mojiMoriLogo} alt="" />
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className={`moji-nav-link${levelsActive ? " is-active" : ""}${litId === "levels" ? " is-lit" : ""}`}
                    onPointerEnter={(event: PointerEvent<HTMLButtonElement>) =>
                      hoverTrigger(event.currentTarget)
                    }
                  >
                    {t("mojimori.nav.levels")}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="moji-level-menu">
                    {MOJI_MORI_LEVEL_BANDS.map((band) => (
                      <div key={band.key} className="moji-level-row">
                        <span className="moji-level-band">
                          <span className="moji-level-band__mark">
                            {band.ja}
                          </span>
                          <span className="moji-level-band__name">
                            {t(`mojimori.bands.${band.key}`)}
                          </span>
                        </span>
                        <div className="moji-level-nums">
                          {Array.from(
                            { length: band.end - band.start + 1 },
                            (_, index) => band.start + index,
                          ).map((level) => (
                            <Link
                              key={level}
                              href={`/mojimori/levels/${level}`}
                                className={`moji-level-num${currentLevel === level ? " is-current" : ""}`}
                              onClick={() => setMenuValue("")}
                            >
                              {String(level).padStart(2, "0")}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </NavigationMenuContent>
                </NavigationMenuItem>
                {TYPE_MENUS.map((item) => (
                  <TypeBandMenu
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    type={item.type}
                    onHover={hoverTrigger}
                    onNavigate={() => setMenuValue("")}
                    lit={litId === item.type}
                  />
                ))}
                <NavigationMenuItem>
                  <form
                    ref={searchFormRef}
                    data-type="search"
                      className={`moji-nav-link moji-nav-search${searchOpen ? " is-open" : ""}${searchDraft.trim() ? " has-query" : ""}${path.startsWith("/mojimori/search") ? " is-active" : ""}${litId === "search" ? " is-lit" : ""}`}
                    onSubmit={submitSearch}
                    onTransitionEnd={(event) => {
                      if (
                        event.propertyName !== "width" ||
                        event.target !== searchFormRef.current
                      )
                        return;
                      const track = trackRef.current;
                      const form = searchFormRef.current;
                      if (!track || !form || hoveredRef.current !== form)
                        return;
                      setPill(measurePill(form, track, false));
                    }}
                    onPointerEnter={(event) => {
                      setMenuValue("");
                      hoverTrigger(event.currentTarget);
                    }}
                  >
                    <input
                      ref={searchInputRef}
                      value={searchDraft}
                      onChange={(event) => setSearchDraft(event.target.value)}
                      placeholder={t("mojimori.searchPlaceholder")}
                      aria-label={t("mojimori.nav.search")}
                      className="moji-nav-search__input"
                      tabIndex={searchOpen ? 0 : -1}
                      aria-hidden={searchOpen ? undefined : true}
                      onKeyDown={(event) => event.stopPropagation()}
                    />
                    <button
                      type={
                        searchOpen && searchDraft.trim() ? "submit" : "button"
                      }
                      className="moji-nav-search__go"
                      aria-label={t("mojimori.nav.search")}
                      onClick={() => {
                        if (searchOpen) return;
                        setMenuValue("");
                        setSearchOpen(true);
                      }}
                    >
                      <svg
                        className="moji-nav-search__icon moji-nav-search__icon--search"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                      <svg
                        className="moji-nav-search__icon moji-nav-search__icon--go"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                  </form>
                </NavigationMenuItem>
                <NavigationMenuItem className="nav-slot">
                  <button
                    type="button"
                    data-type="theme"
                    className={`moji-nav-link moji-slot-theme${litId === "theme" ? " is-lit" : ""}`}
                    aria-label={themeLabel}
                    tabIndex={scrolled ? 0 : -1}
                    onClick={toggleTheme}
                    onPointerEnter={(event) => {
                      hoverTrigger(event.currentTarget);
                      setMenuValue("");
                    }}
                  >
                    <ThemeIcon size={16} />
                  </button>
                </NavigationMenuItem>
                <NavigationMenuItem
                  className="nav-slot"
                  value="user"
                  inert={scrolled ? undefined : true}
                >
                  <NavigationMenuParts.Trigger
                    data-type="user"
                    className={`moji-nav-link moji-slot-user${litId === "user" ? " is-lit" : ""}`}
                    tabIndex={scrolled ? 0 : -1}
                    aria-label={t("mojimori.nav.user")}
                    onPointerEnter={(event) =>
                      hoverTrigger(event.currentTarget)
                    }
                  >
                    <CircleUserRound size={16} />
                  </NavigationMenuParts.Trigger>
                  <NavigationMenuContent className="moji-user-menu">
                    <Link
                      href="/mojimori/settings"
                      className="moji-user-menu__item"
                      onClick={() => setMenuValue("")}
                    >
                      {t("mojimori.nav.settings")}
                    </Link>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </div>
          </NavigationMenu>
        </div>
        <div className="moji-header-end nav-side nav-side-end">
          <button
            type="button"
            className="moji-theme-toggle"
            aria-label={themeLabel}
            onClick={toggleTheme}
          >
            <ThemeIcon size={22} />
          </button>
          <NavigationMenu
            viewport={false}
            value={floatUserMenu}
            onValueChange={setFloatUserMenu}
            className="moji-user-nav"
          >
          <NavigationMenuList>
            <NavigationMenuItem value="user">
              <NavigationMenuParts.Trigger
                className="moji-float-user"
                aria-label={t("mojimori.nav.user")}
              >
                <CircleUserRound size={24} />
              </NavigationMenuParts.Trigger>
              <NavigationMenuContent className="moji-user-menu">
                <Link
                  href="/mojimori/settings"
                  className="moji-user-menu__item"
                  onClick={() => setFloatUserMenu("")}
                >
                  {t("mojimori.nav.settings")}
                </Link>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        </div>
        <MojiMobileNav
          dark={dark}
          onToggleTheme={toggleTheme}
          layerRef={rootRef}
          onMenuActive={setMobileMenu}
        />
      </header>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
