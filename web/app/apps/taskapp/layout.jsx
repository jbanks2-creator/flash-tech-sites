export const metadata = {
  icons: {
    icon: [
      { url: "/apps/taskapp/icon.svg", type: "image/svg+xml" },
      { url: "/apps/taskapp/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apps/taskapp/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default function TaskAppSegmentLayout({ children }) {
  return children;
}
