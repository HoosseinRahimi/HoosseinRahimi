export const escapeXml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const attributes = (pairs) =>
  Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");

export const rect = ({ className, x, y, width, height, rx, fill, children = "" }) => {
  const open = `<rect${attributes({ class: className, x, y, width, height, rx, fill })}`;
  return children ? `${open}>${children}</rect>` : `${open}/>`;
};

export const circle = ({ className, cx, cy, r, fill }) =>
  `<circle${attributes({ class: className, cx, cy, r, fill })}/>`;

export const text = (value, { className, x, y, anchor } = {}) =>
  `<text${attributes({ class: className, x, y, "text-anchor": anchor })}>${escapeXml(value)}</text>`;

export const rawText = (markup, { className, x, y, anchor } = {}) =>
  `<text${attributes({ class: className, x, y, "text-anchor": anchor })}>${markup}</text>`;

export const heatmapCell = ({ level, x, y, title }) =>
  rect({
    className: `level-${level}`,
    x,
    y,
    width: 9,
    height: 9,
    rx: 2,
    children: title ? `<title>${escapeXml(title)}</title>` : "",
  });

export const pill = ({ x, width, label }) =>
  `${rect({ className: "card", x, width, height: 30, rx: 15 })}${text(label, {
    className: "label tiny",
    x: x + width / 2,
    y: 20,
    anchor: "middle",
  })}`;
