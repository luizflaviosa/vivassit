
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Heart, 
  TrendingUp, 
  CheckCircle2, 
  Stethoscope, 
  Building2, 
  Mail, 
  Calendar,
  Award,
  ArrowRight,
  Sparkles,
  Users,
  Target
} from 'lucide-react';
import { DoctorData, ValueBlock, QualificationOption } from '@/lib/types';

const DOCTOR_DATA: DoctorData = {
  name: 'Dr. Carlos Silva',
  specialty: 'Cardiologia',
  crm: '12345-SP',
  email: 'carlos.silva@cardiovida.com.br',
  clinic: {
    name: 'Clínica CardioVida',
    email: 'contato@cardiovida.com.br',
    type: 'Clínica Médio Porte'
  },
  consultation: {
    duration: 30,
    plan: 'Plano Pro'
  },
  progress: 85
};

const VALUE_BLOCKS: ValueBlock[] = [
  {
    icon: 'clock',
    title: 'Economize Tempo',
    description: 'Automatize processos e tenha mais tempo para o que realmente importa: seus pacientes.'
  },
  {
    icon: 'heart',
    title: 'Conexão Genuína',
    description: 'Fortaleça o vínculo com seus pacientes através de um atendimento personalizado e eficiente.'
  },
  {
    icon: 'trending-up',
    title: 'Cresça Sustentavelmente',
    description: 'Expanda sua prática médica com insights inteligentes e ferramentas de gestão avançadas.'
  }
];

const INITIAL_QUALIFICATIONS: QualificationOption[] = [
  { id: 'telemedicine', label: 'Telemedicina', selected: false },
  { id: 'agenda', label: 'Gestão de Agenda', selected: true },
  { id: 'billing', label: 'Faturamento', selected: false },
  { id: 'patients', label: 'Cadastro de Pacientes', selected: true },
  { id: 'reports', label: 'Relatórios Médicos', selected: false },
  { id: 'integration', label: 'Integração com Planos', selected: true }
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [qualifications, setQualifications] = useState<QualificationOption[]>(INITIAL_QUALIFICATIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(DOCTOR_DATA.progress);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleQualificationToggle = (id: string) => {
    setQualifications(prev => 
      prev?.map(qual => 
        qual?.id === id ? { ...qual, selected: !qual?.selected } : qual
      ) ?? []
    );
  };

  const handleSubmitOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const selectedQualifications = qualifications?.filter(q => q?.selected)?.map(q => q?.label) ?? [];
      
      const payload = {
        doctor: DOCTOR_DATA,
        qualifications: selectedQualifications,
        timestamp: new Date().toISOString()
      };

      // Simulate webhook call
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Redirect to Vivativa panel
      window.location.href = 'https://painel.vivativa.com.br';
    } catch (error) {
      console.error('Erro ao enviar dados:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'clock': return <Clock className="w-8 h-8" />;
      case 'heart': return <Heart className="w-8 h-8" />;
      case 'trending-up': return <TrendingUp className="w-8 h-8" />;
      default: return <Sparkles className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        
        {/* Header Section */}
        <motion.section 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="glass-card rounded-3xl p-8 md:p-12 mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
                Bem-vindo, <span className="text-blue-600">{DOCTOR_DATA?.name ?? 'Doutor'}!</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-6">
                Pronto para transformar a sua prática médica?
              </p>
              <div className="flex items-center justify-center gap-4 text-gray-700">
                <Stethoscope className="w-6 h-6 text-blue-500" />
                <span className="text-lg">
                  {DOCTOR_DATA?.specialty ?? 'Medicina'} • {DOCTOR_DATA?.clinic?.name ?? 'Clínica'}
                </span>
              </div>
            </motion.div>

            {/* Progress Bar */}
            <motion.div 
              className="mt-8"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Configuração da conta</span>
                <span className="text-sm font-semibold text-blue-600">{animatedProgress}%</span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
                <motion.div 
                  className="progress-gradient h-full rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${animatedProgress}%` }}
                  transition={{ duration: 1.5, delay: 1 }}
                />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Value Section */}
        <motion.section 
          className="mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Desbloqueie o potencial da sua clínica
            </h2>
            <p className="text-xl text-gray-600">
              Junte-se a milhares de médicos que transformaram sua prática
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {VALUE_BLOCKS?.map((block, index) => (
              <motion.div
                key={block?.title ?? index}
                className="glass-card rounded-2xl p-8 text-center hover:bg-white/20 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                whileHover={{ scale: 1.05 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl mb-6">
                  <div className="text-white">
                    {getIcon(block?.icon ?? 'sparkles')}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  {block?.title ?? 'Título'}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {block?.description ?? 'Descrição do benefício'}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Qualification Section */}
        <motion.section 
          className="mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="glass-card rounded-3xl p-8 md:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Personalize sua experiência
              </h2>
              <p className="text-xl text-gray-600">
                Selecione as funcionalidades mais importantes para você
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {qualifications?.map((qualification, index) => (
                <motion.button
                  key={qualification?.id ?? index}
                  onClick={() => handleQualificationToggle(qualification?.id ?? '')}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    qualification?.selected
                      ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                      : 'border-gray-200 bg-white/30 text-gray-700 hover:border-gray-300'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 
                      className={`w-5 h-5 ${
                        qualification?.selected ? 'text-blue-500' : 'text-gray-300'
                      }`}
                    />
                    <span className="font-medium">
                      {qualification?.label ?? 'Funcionalidade'}
                    </span>
                  </div>
                </motion.button>
              )) ?? []}
            </div>
          </div>
        </motion.section>

        {/* Confirmation Section */}
        <motion.section 
          className="mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Seu Espaço. Seu Legado.
            </h2>
            <p className="text-xl text-gray-600">
              Confirmamos suas informações e estamos prontos para começar
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Doctor Card */}
            <motion.div 
              className="glass-card rounded-2xl p-8"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Perfil Médico</h3>
                  <p className="text-gray-600">Seus dados profissionais</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nome:</span>
                  <span className="font-medium text-gray-800">
                    {DOCTOR_DATA?.name ?? 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Especialidade:</span>
                  <span className="font-medium text-gray-800">
                    {DOCTOR_DATA?.specialty ?? 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CRM:</span>
                  <span className="font-medium text-gray-800">
                    {DOCTOR_DATA?.crm ?? 'N/A'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Clinic Card */}
            <motion.div 
              className="glass-card rounded-2xl p-8"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Dados da Clínica</h3>
                  <p className="text-gray-600">Informações do estabelecimento</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Clínica:</span>
                  <span className="font-medium text-gray-800">
                    {DOCTOR_DATA?.clinic?.name ?? 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium text-gray-800">
                    {DOCTOR_DATA?.clinic?.type ?? 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Plano:</span>
                  <span className="font-medium text-blue-600">
                    {DOCTOR_DATA?.consultation?.plan ?? 'N/A'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section 
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="glass-card rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">
              Pronto para revolucionar sua prática médica?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Seu painel personalizado está configurado e esperando por você
            </p>
            
            <motion.button
              onClick={handleSubmitOnboarding}
              disabled={isSubmitting}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:from-blue-700 hover:to-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Configurando...
                </>
              ) : (
                <>
                  Acessar o Painel Vivativa
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>

            <div className="flex items-center justify-center gap-8 mt-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Configuração segura</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Suporte especializado</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                <span>Resultados comprovados</span>
              </div>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
