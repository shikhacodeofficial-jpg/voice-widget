import dynamic from "next/dynamic";

const VoiceWidget = dynamic(() => import("@/components/VoiceWidget"), {
  ssr: false,
});

export default function WidgetPage() {
  return (
    <html>
      <body style={{ margin: 0, background: "transparent" }}>
        <VoiceWidget />
      </body>
    </html>
  );
}
