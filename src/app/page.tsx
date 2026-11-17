import { TelemetryMonitor } from "@/components/TelemetryMonitor";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 p-6 font-sans dark:bg-black">
      <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
        IOT-Automation
      </h1>
      <TelemetryMonitor />
    </main>
  );
}
