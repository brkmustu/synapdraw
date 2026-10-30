import "./ExcalidrawLogo.scss";

/**
 * SynapDraw logo mark following Excalidraw's standard monochrome currentColor
 * Tabler stroke/node aesthetic (--color-logo-icon & --color-logo-text).
 */
const LogoIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.85"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-icon"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <circle cx="18" cy="5" r="2.5" fill="currentColor" />
    <circle cx="6" cy="12" r="2.5" fill="currentColor" />
    <circle cx="18" cy="19" r="2.5" fill="currentColor" />
    <circle cx="6" cy="5" r="2" />
    <circle cx="18" cy="12" r="2" />
    <circle cx="6" cy="19" r="2" />
    <path d="M8.2 10.7L15.8 6.3" />
    <path d="M8.2 13.3L15.8 17.7" />
    <path d="M8 5h7.5" strokeDasharray="2 2" />
    <path d="M8.5 12h7.5" />
    <path d="M8 19h7.5" strokeDasharray="2 2" />
  </svg>
);

const LogoText = () => (
  <svg
    width="156"
    height="34"
    viewBox="0 0 156 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-text"
  >
    <text
      x="0"
      y="25"
      fill="currentColor"
      style={{
        fontFamily:
          "Assistant, Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 800,
        fontSize: "26px",
        letterSpacing: "-0.03em",
      }}
    >
      SynapDraw
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  /**
   * If true, the logo will not be wrapped in a Link component.
   * The link prop will be ignored as well.
   * It will merely be a plain div.
   */
  isNotLink?: boolean;
}

export const ExcalidrawLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};
