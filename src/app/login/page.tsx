import { AuthScreen } from "@/contexts/access";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const rawCallback = typeof sp?.callbackUrl === "string" ? sp.callbackUrl : "/";
  const callbackUrl = rawCallback.startsWith("/") ? rawCallback : "/";

  return (
    <main className="min-h-screen w-full bg-[#09090f]">
      <AuthScreen callbackUrl={callbackUrl} />
    </main>
  );
}
