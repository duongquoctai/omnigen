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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] p-4">
      <AuthScreen callbackUrl={callbackUrl} />
    </div>
  );
}
