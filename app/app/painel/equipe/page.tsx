'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, X, Crown, Users, Mail, Loader2, Trash2, Check, Clock } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface Member {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  email: string;
  role: 'owner' | 'admin' | 'doctor' | 'staff' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  doctor_id: string | null;
  telegram_chat_id: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<Member['role'], { label: string; desc: string }> = {
  owner: { label: 'Proprietário', desc: 'Acesso total. Único por clínica.' },
  admin: { label: 'Administrador', desc: 'Pode convidar membros e mexer em tudo.' },
  doctor: { label: 'Profissional', desc: 'Vê agenda, pacientes, mensagens.' },
  staff: { label: 'Equipe', desc: 'Recepção, secretaria. Acesso operacional.' },
  viewer: { label: 'Leitura', desc: 'Só visualiza, não edita.' },
};

function EquipeInner() {
  const [members, setMembers] = useState<Member[]>([]);
  const [yourRole, setYourRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Member['role']>('doctor');

  const canManage = yourRole === 'owner' || yourRole === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/painel/members');
      const j = await r.json();
      if (j.success) {
        setMembers(j.members);
        setYourRole(j.your_role);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/painel/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        const errMap: Record<string, string> = {
          invalid_email: 'Email inválido',
          already_invited: 'Esse email já está convidado nesta clínica',
          forbidden: 'Você não tem permissão pra convidar',
          cannot_invite_owner: 'Não dá pra convidar como proprietário',
        };
        toast.error(errMap[j.error] ?? j.error ?? 'Erro ao convidar');
        return;
      }
      toast.success('Convite enviado');
      setInviteEmail('');
      setShowInvite(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (m: Member) => {
    if (!confirm(`Remover ${m.email} desta clínica?`)) return;
    const r = await fetch(`/api/painel/members?id=${m.id}`, { method: 'DELETE' });
    if (r.ok) {
      toast.success('Membro removido');
      await load();
    } else {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error === 'cannot_remove_owner' ? 'Owner não pode ser removido' : 'Falhou');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Equipe
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Membros da <span className="font-serif italic font-normal text-zinc-700">clínica</span>
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Convide outros profissionais e funcionários. Cada um tem seu próprio login e Telegram do agente interno.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110"
            style={{ background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          >
            <UserPlus className="w-4 h-4" />
            Convidar membro
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} canManage={canManage} onRemove={() => remove(m)} />
          ))}
        </div>
      )}

      {!canManage && (
        <p className="text-[12px] text-zinc-400">
          Apenas owner ou admin podem convidar/remover membros. Seu papel: <strong>{yourRole || '—'}</strong>
        </p>
      )}

      {/* Modal de convite — bottom sheet no mobile, centered no desktop */}
      <AnimatePresence>
        {showInvite && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setShowInvite(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-50 flex flex-col bg-white shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.25)]
                         inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl
                         md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                         md:bottom-auto md:w-full md:max-w-md md:rounded-2xl md:max-h-[85vh]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Drag handle visual — só mobile */}
              <div className="md:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
                <span className="block w-10 h-1 rounded-full bg-zinc-300" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 md:py-4 border-b border-black/[0.06] flex-shrink-0">
                <h2 className="text-[17px] md:text-[16px] font-semibold text-zinc-900">Convidar membro</h2>
                <button
                  onClick={() => setShowInvite(false)}
                  className="h-9 w-9 -mr-1 inline-flex items-center justify-center rounded-md hover:bg-zinc-100"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
              <form onSubmit={invite} className="px-5 py-4 space-y-4 overflow-y-auto">
                <div>
                  <label className="text-[12.5px] font-semibold text-zinc-900 block mb-1.5">Email do convidado</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="email"
                      autoFocus
                      required
                      autoComplete="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="medico@email.com"
                      className="w-full h-12 sm:h-11 pl-9 pr-3.5 bg-white text-[16px] sm:text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[12.5px] font-semibold text-zinc-900 block mb-1.5">Papel</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(['admin', 'doctor', 'staff', 'viewer'] as const).map((r) => {
                      const cfg = ROLE_LABELS[r];
                      const selected = inviteRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInviteRole(r)}
                          className={`text-left p-3 rounded-lg transition-all ${
                            selected ? 'bg-white border border-transparent' : 'bg-white border border-black/[0.08] hover:border-black/20'
                          }`}
                          style={selected ? { boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[13.5px] font-semibold text-zinc-900">{cfg.label}</p>
                              <p className="text-[11.5px] text-zinc-500 mt-0.5">{cfg.desc}</p>
                            </div>
                            {selected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT_DEEP }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11.5px] text-zinc-500 leading-relaxed">
                  O convidado recebe acesso ao logar com este email pela primeira vez. Se ainda não tem conta,
                  basta usar Google ou link mágico em <code>/login</code>.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.05]">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="h-10 px-4 rounded-lg text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 hover:brightness-110"
                    style={{ background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Convidar
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberRow({ member, canManage, onRemove }: { member: Member; canManage: boolean; onRemove: () => void }) {
  const cfg = ROLE_LABELS[member.role];
  const isPending = member.status === 'invited';
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-full inline-flex items-center justify-center text-white flex-shrink-0"
        style={{ background: member.role === 'owner' ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` : '#94a3b8' }}
      >
        {member.role === 'owner' ? <Crown className="w-4 h-4" /> : <Users className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-semibold text-zinc-900 truncate">{member.email}</p>
          <span
            className="inline-flex items-center text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            {cfg.label}
          </span>
          {isPending && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded text-amber-700 bg-amber-50">
              <Clock className="w-2.5 h-2.5" /> Pendente
            </span>
          )}
        </div>
        <p className="text-[12px] text-zinc-500 mt-0.5">
          {isPending
            ? 'Aguardando primeiro login com este email'
            : `Membro desde ${new Date(member.created_at).toLocaleDateString('pt-BR')}`}
        </p>
      </div>
      {canManage && member.role !== 'owner' && (
        <button
          onClick={onRemove}
          className="h-9 w-9 rounded-md hover:bg-rose-50 hover:text-rose-600 text-zinc-400 inline-flex items-center justify-center transition-colors"
          title="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function EquipePage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <EquipeInner />
    </Suspense>
  );
}
