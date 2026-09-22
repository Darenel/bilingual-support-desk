import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "@/components/forms";
import { getLocale } from "@/lib/i18n-server";
import { PreferenceControls } from "@/components/preferences";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const es = (await getLocale()) === "es";
  const register = (await searchParams).mode === "register";
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="brand" href="/">
          Support Desk
        </Link>
        <PreferenceControls />
      </header>
      <section className="auth-card">
        <p className="eyebrow">
          {register ? (es ? "EMPIEZA HOY" : "START TODAY") : (es ? "BIENVENIDO DE VUELTA" : "WELCOME BACK")}
        </p>
        <h1>
          {register ? (es ? "Crea tu espacio de soporte" : "Create your support workspace") : (es ? "Entra a tu espacio" : "Sign in to your workspace")}
        </h1>
        <p>
          {register
            ? (es ? "Configura lo esencial y comienza a recibir conversaciones." : "Set up the essentials and start receiving conversations.")
            : (es ? "Usa tus datos de trabajo para continuar." : "Use your work details to continue.")}
        </p>
        <AuthForm register={register} />
        <p className="switch">
          {register ? (es ? "¿Ya tienes una cuenta?" : "Already have an account?") : (es ? "¿Aún no tienes un espacio?" : "Need a workspace?")}{" "}
          <Link href={register ? "/login" : "/login?mode=register"}>
            {register ? (es ? "Entrar" : "Sign in") : (es ? "Crear espacio" : "Create workspace")}
          </Link>
        </p>
      </section>
    </main>
  );
}
