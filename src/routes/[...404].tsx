import { createServerData$ } from "solid-start/server";

export default function NotFound() {
  const data = createServerData$
  
  return (
    <main class="w-full p-4 space-y-2">
      <h1 class="font-bold text-xl">Page Not Found</h1>
      <p></p>
    </main>
  );
}
