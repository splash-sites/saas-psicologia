import { redirect } from "next/navigation";

// Virou a aba "Meses anteriores" do A receber (redesenho de 2026-11-25).
export default async function MesesAnterioresPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const m = /^\d{4}-\d{2}$/.test(mes ?? "") ? `mes=${mes}&` : "";
  redirect(`/financeiro/a-receber?${m}aba=anteriores`);
}
