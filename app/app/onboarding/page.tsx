
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  ArrowRight,
  ArrowLeft,
  CheckCircle2, 
  User,
  Building2,
  Settings,
  Shield,
  Zap,
  Star,
  Phone,
  Clock,
  Heart,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { 
  OnboardingData, 
  ValueBlock, 
  QualificationOption, 
  WizardStep,
  ESTABLISHMENT_TYPES,
  PLAN_TYPES,
  SPECIALITIES
} from '@/lib/types';

const VALUE_BLOCKS: ValueBlock[] = [
  {
    icon: 'clock',
    title: 'Mais tempo para o que importa',
    description: 'Com agendamento inteligente e lembretes automáticos, você foca nos pacientes enquanto a Vivassit cuida da burocracia.'
  },
  {
    icon: 'heart',
    title: 'Uma ponte direta com seus pacientes',
    description: 'Comunicação fluida via WhatsApp e histórico 100% digital que centraliza cada detalhe do atendimento.'
  },
  {
    icon: 'trending-up',
    title: 'Sua prática, mais forte e lucrativa',
    description: 'Reduza faltas em até 60% e receba pagamentos seguros, enquanto nossos relatórios mostram o caminho do crescimento.'
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

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: 'Dados Profissionais',
    description: 'Informações sobre você como profissional de saúde',
    fields: ['doctor_name', 'doctor_crm', 'speciality']
  },
  {
    id: 2,
    title: 'Dados da Clínica',
    description: 'Informações do seu estabelecimento médico',
    fields: ['clinic_name', 'admin_email', 'real_phone']
  },
  {
    id: 3,
    title: 'Configurações',
    description: 'Defina suas preferências de atendimento',
    fields: ['consultation_duration', 'establishment_type', 'plan_type']
  },
  {
    id: 4,
    title: 'Confirmação',
    description: 'Revise e confirme suas informações',
    fields: []
  }
];

const INITIAL_DATA: OnboardingData = {
  real_phone: '',
  clinic_name: '',
  admin_email: '',
  doctor_name: '',
  doctor_crm: '',
  speciality: '',
  consultation_duration: '30',
  establishment_type: 'small_clinic',
  plan_type: 'professional',
};

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingData>(INITIAL_DATA);
  const [qualifications, setQualifications] = useState<QualificationOption[]>(INITIAL_QUALIFICATIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [todaySignups, setTodaySignups] = useState(0);
  const [formStartTime] = useState(new Date().toISOString()); // Tempo de início do formulário

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  // Animate counters
  useEffect(() => {
    const signupTarget = 89;
    
    const signupTimer = setInterval(() => {
      setTodaySignups(prev => {
        const increment = Math.ceil((signupTarget - prev) / 20);
        return prev + increment < signupTarget ? prev + increment : signupTarget;
      });
    }, 100);

    return () => clearInterval(signupTimer);
  }, []);

  const handleInputChange = (field: keyof OnboardingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleQualificationToggle = (id: string) => {
    setQualifications(prev => 
      prev?.map(qual => 
        qual?.id === id ? { ...qual, selected: !qual?.selected } : qual
      ) ?? []
    );
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    const stepFields = WIZARD_STEPS[step]?.fields || [];

    stepFields.forEach(field => {
      const value = formData[field as keyof OnboardingData];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        newErrors[field] = 'Este campo é obrigatório';
      }
    });

    // Email validation
    if (stepFields.includes('admin_email') && formData.admin_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.admin_email)) {
        newErrors.admin_email = 'Email inválido';
      }
    }

    // Phone validation
    if (stepFields.includes('real_phone') && formData.real_phone) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(formData.real_phone)) {
        newErrors.real_phone = 'Telefone inválido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmitOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const selectedQualifications = qualifications?.filter(q => q?.selected)?.map(q => q?.label) ?? [];
      
      const formEndTime = new Date().toISOString();
      const formCompletionTime = Math.round((new Date().getTime() - new Date(formStartTime).getTime()) / 1000); // segundos

      const payload = {
        ...formData,
        qualifications: selectedQualifications,
        timestamp: formEndTime,
        source: 'vivassit-onboarding-wizard', // Identificação específica para N8N
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        form_start_time: formStartTime,
        form_end_time: formEndTime,
        form_completion_time: formCompletionTime,
        workflow_version: '4.0' // Versão alinhada com N8N workflow
      };

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Client-Version': '4.0.0',
          'X-Workflow-Target': 'n8n-v4'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Success message with tenant_id
        const tenantId = result.data?.tenant_id || 'N/A';
        const clinicName = result.data?.clinic_name || formData.clinic_name;
        
        alert(`🎉 Parabéns! Sua conta Vivassit foi criada com sucesso!\n\n📋 Dados da sua clínica:\n• Nome: ${clinicName}\n• ID do Tenant: ${tenantId}\n\n📧 Em alguns minutos você receberá um email com os próximos passos e instruções de acesso.\n\n💪 Bem-vindo à revolução da medicina digital!`);
        
        // Redirect to landing page with success parameter
        setTimeout(() => {
          window.location.href = '/landing?success=true&tenant=' + encodeURIComponent(tenantId);
        }, 3000);
      } else {
        // Handle API errors with more detail
        const errorMessage = result.message || 'Erro desconhecido';
        const missingFields = result.missing_fields || [];
        
        if (missingFields.length > 0) {
          alert(`⚠️ Campos obrigatórios não preenchidos:\n\n${missingFields.map((field: string) => '• ' + field).join('\n')}\n\nPor favor, volte e preencha todos os campos obrigatórios.`);
        } else {
          alert(`❌ Erro no cadastro: ${errorMessage}\n\nTente novamente ou entre em contato com nosso suporte.`);
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: unknown) {
      console.error('❌ Erro ao enviar dados:', error);
      
      // More specific error messages
      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('🔌 Erro de conexão. Verifique sua internet e tente novamente.');
      } else if (error instanceof Error && error.message.includes('400')) {
        alert('📝 Dados incompletos ou inválidos. Verifique os campos e tente novamente.');
      } else if (error instanceof Error && error.message.includes('500')) {
        alert('🔧 Erro no servidor. Nossa equipe foi notificada e irá resolver o problema em breve.');
      } else {
        alert('❌ Ops! Algo deu errado.\n\nTente novamente em alguns minutos ou entre em contato com nosso suporte:\n📞 WhatsApp: +55 11 99999-9999\n📧 Email: suporte@vivassit.com.br');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'clock': return <Clock className="w-6 h-6" />;
      case 'heart': return <Heart className="w-6 h-6" />;
      case 'trending-up': return <TrendingUp className="w-6 h-6" />;
      default: return <Sparkles className="w-6 h-6" />;
    }
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 0: return <User className="w-5 h-5" />;
      case 1: return <Building2 className="w-5 h-5" />;
      case 2: return <Settings className="w-5 h-5" />;
      case 3: return <CheckCircle2 className="w-5 h-5" />;
      default: return <CheckCircle2 className="w-5 h-5" />;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.doctor_name}
                onChange={(e) => handleInputChange('doctor_name', e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  errors.doctor_name ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-purple-300'
                }`}
                placeholder="Ex: Dr. João Silva"
              />
              {errors.doctor_name && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errors.doctor_name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                CRM *
              </label>
              <input
                type="text"
                value={formData.doctor_crm}
                onChange={(e) => handleInputChange('doctor_crm', e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  errors.doctor_crm ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-purple-300'
                }`}
                placeholder="Ex: CRM/SP 123456"
              />
              {errors.doctor_crm && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errors.doctor_crm}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Especialidade *
              </label>
              <select
                value={formData.speciality}
                onChange={(e) => handleInputChange('speciality', e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  errors.speciality ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <option value="">Selecione sua especialidade</option>
                {SPECIALITIES.map(spec => (
                  <option key={spec} value={spec}>
                    {spec.charAt(0).toUpperCase() + spec.slice(1)}
                  </option>
                ))}
              </select>
              {errors.speciality && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errors.speciality}
                </p>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Nome da Clínica *
              </label>
              <input
                type="text"
                value={formData.clinic_name}
                onChange={(e) => handleInputChange('clinic_name', e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  errors.clinic_name ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-purple-300'
                }`}
                placeholder="Ex: Clínica Saúde & Vida"
              />
              {errors.clinic_name && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errors.clinic_name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Email Administrativo *
              </label>
              <input
                type="email"
                value={formData.admin_email}
                onChange={(e) => handleInputChange('admin_email', e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  errors.admin_email ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-purple-300'
                }`}
                placeholder="admin@clinica.com.br"
              />
              {errors.admin_email && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errors.admin_email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Telefone *
              </label>
              <input
                type="tel"
                value={formData.real_phone}
                onChange={(e) => handleInputChange('real_phone', e.target.value)}
                className={`w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  errors.real_phone ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-purple-300'
                }`}
                placeholder="+55 11 99999-9999"
              />
              {errors.real_phone && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errors.real_phone}
                </p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Duração Padrão da Consulta (minutos) *
                </label>
                <select
                  value={formData.consultation_duration}
                  onChange={(e) => handleInputChange('consultation_duration', e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 border-gray-200 hover:border-purple-300"
                >
                  <option value="15">15 minutos</option>
                  <option value="20">20 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">60 minutos</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tipo de Estabelecimento *
                </label>
                <select
                  value={formData.establishment_type}
                  onChange={(e) => handleInputChange('establishment_type', e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 border-gray-200 hover:border-purple-300"
                >
                  {Object.entries(ESTABLISHMENT_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Plano Escolhido *
                </label>
                <select
                  value={formData.plan_type}
                  onChange={(e) => handleInputChange('plan_type', e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 border-gray-200 hover:border-purple-300"
                >
                  {Object.entries(PLAN_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modern Qualifications Section */}
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                🚀 Funcionalidades de Interesse
              </h3>
              <p className="text-gray-600 mb-6">
                Selecione as funcionalidades mais importantes para você
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {qualifications?.map((qualification, index) => (
                  <motion.button
                    key={qualification?.id ?? index}
                    type="button"
                    onClick={() => handleQualificationToggle(qualification?.id ?? '')}
                    className={`selection-button p-4 text-left transition-all duration-300 ${
                      qualification?.selected ? 'selected' : ''
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        qualification?.selected 
                          ? 'border-purple-500 bg-purple-500' 
                          : 'border-gray-300'
                      }`}>
                        {qualification?.selected && (
                          <CheckCircle2 className="w-3 h-3 text-white fill-current" />
                        )}
                      </div>
                      <span className="font-semibold text-gray-800">
                        {qualification?.label ?? 'Funcionalidade'}
                      </span>
                    </div>
                  </motion.button>
                )) ?? []}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Quase pronto!</h3>
              <p className="text-gray-600">Revise suas informações antes de finalizar</p>
            </div>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Doctor Info */}
              <div className="feature-card p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Dados Profissionais</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nome:</span>
                    <span className="font-semibold text-gray-800">{formData.doctor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CRM:</span>
                    <span className="font-semibold text-gray-800">{formData.doctor_crm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Especialidade:</span>
                    <span className="font-semibold text-gray-800 capitalize">{formData.speciality}</span>
                  </div>
                </div>
              </div>

              {/* Clinic Info */}
              <div className="feature-card p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Dados da Clínica</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Clínica:</span>
                    <span className="font-semibold text-gray-800">{formData.clinic_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-semibold text-gray-800">{formData.admin_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Telefone:</span>
                    <span className="font-semibold text-gray-800">{formData.real_phone}</span>
                  </div>
                </div>
              </div>

              {/* Settings Info */}
              <div className="feature-card p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-green-500 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Configurações</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Consulta:</span>
                    <span className="font-semibold text-gray-800">{formData.consultation_duration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estabelecimento:</span>
                    <span className="font-semibold text-gray-800">
                      {ESTABLISHMENT_TYPES[formData.establishment_type as keyof typeof ESTABLISHMENT_TYPES]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plano:</span>
                    <span className="font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {PLAN_TYPES[formData.plan_type as keyof typeof PLAN_TYPES]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected Features */}
              <div className="feature-card p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Funcionalidades</h3>
                </div>
                <div className="space-y-2">
                  {qualifications?.filter(q => q?.selected)?.map((qual, index) => (
                    <div key={qual?.id ?? index} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-700">{qual?.label}</span>
                    </div>
                  )) ?? []}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Top Header with Logo and Stats */}
        <motion.div 
          className="flex flex-col md:flex-row justify-between items-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="logo-container mb-4 md:mb-0">
            <Image
              src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
              alt="Vivassit"
              width={180}
              height={60}
              className="h-12 w-auto"
              priority
            />
          </div>

          <div className="stats-counter px-4 py-2 rounded-full text-sm font-semibold">
            🔥 Últimas {89 - todaySignups} vagas hoje
          </div>
        </motion.div>

        {/* Social Proof Badge */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="social-proof-badge inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm mb-6">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">
              Mais de 5.000 médicos já automatizaram suas práticas
            </span>
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          </div>
        </motion.div>
        
        {/* Header Section */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Configure sua conta
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent"> Vivassit</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Só mais alguns dados e você estará pronto para <strong>revolucionar</strong> sua prática médica
          </p>

          {/* Trust Signals */}
          <motion.div 
            className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="trust-signal flex items-center gap-2 px-4 py-2 rounded-xl">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Dados 100% seguros</span>
            </div>
            <div className="trust-signal flex items-center gap-2 px-4 py-2 rounded-xl">
              <Zap className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">Configuração em 5 minutos</span>
            </div>
          </motion.div>

          {/* Progress Bar */}
          <div className="glass-card rounded-3xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Progresso da configuração</span>
              <span className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-white/40 rounded-full h-4 overflow-hidden">
              <motion.div 
                className="progress-gradient h-full rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            
            {/* Step Indicators */}
            <div className="flex justify-between mt-6">
              {WIZARD_STEPS.map((step, index) => (
                <div key={step.id} className="flex flex-col items-center">
                  <motion.div 
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-all duration-300 ${
                      index <= currentStep 
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg' 
                        : 'bg-white/40 text-gray-400'
                    }`}
                    whileHover={{ scale: 1.05 }}
                  >
                    {getStepIcon(index)}
                  </motion.div>
                  <span className={`text-xs text-center font-medium ${
                    index <= currentStep ? 'text-purple-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Value Proposition - Show only on first step */}
        <AnimatePresence>
          {currentStep === 0 && (
            <motion.section 
              className="mb-12"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">
                  Por que mais de <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">5.000 médicos</span> escolheram a Vivassit?
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {VALUE_BLOCKS?.map((block, index) => (
                  <motion.div
                    key={block?.title ?? index}
                    className="feature-card p-6 rounded-2xl text-center"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4">
                      <div className="text-white">
                        {getIcon(block?.icon ?? 'sparkles')}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                      {block?.title ?? 'Título'}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {block?.description ?? 'Descrição do benefício'}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Main Form */}
        <motion.div 
          className="glass-card rounded-3xl p-8 md:p-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {WIZARD_STEPS[currentStep]?.title}
            </h2>
            <p className="text-gray-600">
              {WIZARD_STEPS[currentStep]?.description}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <motion.button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="cta-secondary px-6 py-3 rounded-2xl font-semibold inline-flex items-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: currentStep > 0 ? 1.02 : 1 }}
              whileTap={{ scale: currentStep > 0 ? 0.98 : 1 }}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </motion.button>

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <motion.button
                type="button"
                onClick={handleNext}
                className="cta-primary text-white px-8 py-3 rounded-2xl font-bold inline-flex items-center gap-2 transition-all duration-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Próximo
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={handleSubmitOnboarding}
                disabled={isSubmitting}
                className="cta-primary text-white px-10 py-3 rounded-2xl font-bold inline-flex items-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Criando sua conta...
                  </>
                ) : (
                  <>
                    🚀 Criar Minha Conta Vivassit
                  </>
                )}
              </motion.button>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
