// Avatar do paciente: iniciais num tom pastel fixo (o mesmo paciente sempre
// cai no mesmo tom). Usado na lista de pacientes e no Financeiro.

const CORES_AVATAR = [
  "bg-[#DCF0EC] text-[#0B3F3A]",
  "bg-[#FBF2DC] text-[#5C460F]",
  "bg-[#E7E4F6] text-[#3A2F73]",
  "bg-[#FCE6DA] text-[#7A2A0A]",
  "bg-[#E1ECF7] text-[#1E3A5F]",
  "bg-[#FCE7EF] text-[#8A1F4C]",
];

export function corAvatar(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES_AVATAR[h % CORES_AVATAR.length];
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
