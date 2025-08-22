
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
  ArrowLeft,
  Sparkles,
  Users,
  Target,
  Phone,
  User,
  FileText,
  Settings
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
  const [errors, setErrors] = useState<Partial<OnboardingData>>({});

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const handleInputChange = (field: keyof OnboardingData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
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
    const newErrors: Partial<OnboardingData> = {};
    const stepFields = WIZARD_STEPS[step]?.fields || [];

    stepFields.forEach(field => {
      const value = formData[field as keyof OnboardingData];
      if (!value || value.trim() === '') {
        newErrors[field as keyof OnboardingData] = 'Este campo é obrigatório';
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
      
      const payload = {
        ...formData,
        qualifications: selectedQualifications,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Success - show success message or redirect
        alert('Cadastro realizado com sucesso!');
      } else {
        throw new Error('Erro ao enviar dados');
      }
    } catch (error) {
      console.error('Erro ao enviar dados:', error);
      alert('Erro ao realizar cadastro. Tente novamente.');
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

  const getStepIcon = (step: number) => {
    switch (step) {
      case 0: return <User className="w-6 h-6" />;
      case 1: return <Building2 className="w-6 h-6" />;
      case 2: return <Settings className="w-6 h-6" />;
      case 3: return <CheckCircle2 className="w-6 h-6" />;
      default: return <FileText className="w-6 h-6" />;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.doctor_name}
                onChange={(e) => handleInputChange('doctor_name', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.doctor_name ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                placeholder="Ex: Dr. João Silva"
              />
              {errors.doctor_name && (
                <p className="text-red-500 text-sm mt-1">{errors.doctor_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CRM *
              </label>
              <input
                type="text"
                value={formData.doctor_crm}
                onChange={(e) => handleInputChange('doctor_crm', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.doctor_crm ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                placeholder="Ex: CRM/SP 123456"
              />
              {errors.doctor_crm && (
                <p className="text-red-500 text-sm mt-1">{errors.doctor_crm}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Especialidade *
              </label>
              <select
                value={formData.speciality}
                onChange={(e) => handleInputChange('speciality', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.speciality ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
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
                <p className="text-red-500 text-sm mt-1">{errors.speciality}</p>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Clínica *
              </label>
              <input
                type="text"
                value={formData.clinic_name}
                onChange={(e) => handleInputChange('clinic_name', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.clinic_name ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                placeholder="Ex: Clínica Saúde & Vida"
              />
              {errors.clinic_name && (
                <p className="text-red-500 text-sm mt-1">{errors.clinic_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Administrativo *
              </label>
              <input
                type="email"
                value={formData.admin_email}
                onChange={(e) => handleInputChange('admin_email', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.admin_email ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                placeholder="admin@clinica.com.br"
              />
              {errors.admin_email && (
                <p className="text-red-500 text-sm mt-1">{errors.admin_email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone *
              </label>
              <input
                type="tel"
                value={formData.real_phone}
                onChange={(e) => handleInputChange('real_phone', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.real_phone ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                placeholder="+55 11 99999-9999"
              />
              {errors.real_phone && (
                <p className="text-red-500 text-sm mt-1">{errors.real_phone}</p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duração Padrão da Consulta (minutos) *
              </label>
              <select
                value={formData.consultation_duration}
                onChange={(e) => handleInputChange('consultation_duration', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-200 hover:border-gray-300"
              >
                <option value="15">15 minutos</option>
                <option value="20">20 minutos</option>
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">60 minutos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Estabelecimento *
              </label>
              <select
                value={formData.establishment_type}
                onChange={(e) => handleInputChange('establishment_type', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-200 hover:border-gray-300"
              >
                {Object.entries(ESTABLISHMENT_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plano Escolhido *
              </label>
              <select
                value={formData.plan_type}
                onChange={(e) => handleInputChange('plan_type', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 bg-white/50 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-200 hover:border-gray-300"
              >
                {Object.entries(PLAN_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            {/* Qualifications Section */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Funcionalidades de Interesse
              </h3>
              <p className="text-gray-600 mb-6">
                Selecione as funcionalidades mais importantes para você
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {qualifications?.map((qualification, index) => (
                  <motion.button
                    key={qualification?.id ?? index}
                    type="button"
                    onClick={() => handleQualificationToggle(qualification?.id ?? '')}
                    className={`p-3 rounded-lg border-2 transition-all duration-300 text-left ${
                      qualification?.selected
                        ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                        : 'border-gray-200 bg-white/30 text-gray-700 hover:border-gray-300'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 
                        className={`w-4 h-4 ${
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
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Doctor Info */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Dados Profissionais</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nome:</span>
                    <span className="font-medium text-gray-800">{formData.doctor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CRM:</span>
                    <span className="font-medium text-gray-800">{formData.doctor_crm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Especialidade:</span>
                    <span className="font-medium text-gray-800 capitalize">{formData.speciality}</span>
                  </div>
                </div>
              </div>

              {/* Clinic Info */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Dados da Clínica</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Clínica:</span>
                    <span className="font-medium text-gray-800">{formData.clinic_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium text-gray-800">{formData.admin_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Telefone:</span>
                    <span className="font-medium text-gray-800">{formData.real_phone}</span>
                  </div>
                </div>
              </div>

              {/* Settings Info */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Configurações</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Consulta:</span>
                    <span className="font-medium text-gray-800">{formData.consultation_duration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estabelecimento:</span>
                    <span className="font-medium text-gray-800">
                      {ESTABLISHMENT_TYPES[formData.establishment_type as keyof typeof ESTABLISHMENT_TYPES]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plano:</span>
                    <span className="font-medium text-blue-600">
                      {PLAN_TYPES[formData.plan_type as keyof typeof PLAN_TYPES]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected Features */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Funcionalidades</h3>
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
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Header Section */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Cadastro Médico
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Configure sua conta e transforme sua prática médica
          </p>

          {/* Progress Bar */}
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">Progresso</span>
              <span className="text-sm font-semibold text-blue-600">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
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
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                      index <= currentStep 
                        ? 'bg-gradient-to-br from-blue-500 to-green-500 text-white' 
                        : 'bg-white/30 text-gray-400'
                    }`}
                    whileHover={{ scale: 1.05 }}
                  >
                    {getStepIcon(index)}
                  </motion.div>
                  <span className={`text-xs text-center ${
                    index <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'
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
                  Revolucione sua prática médica
                </h2>
                <p className="text-lg text-gray-600">
                  Junte-se a milhares de médicos que transformaram sua rotina
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {VALUE_BLOCKS?.map((block, index) => (
                  <motion.div
                    key={block?.title ?? index}
                    className="glass-card rounded-xl p-6 text-center hover:bg-white/20 transition-all duration-300"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl mb-4">
                      <div className="text-white">
                        {getIcon(block?.icon ?? 'sparkles')}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
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
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: currentStep > 0 ? 1.02 : 1 }}
              whileTap={{ scale: currentStep > 0 ? 0.98 : 1 }}
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </motion.button>

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <motion.button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-green-700 transition-all duration-300"
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
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Finalizando...
                  </>
                ) : (
                  <>
                    Finalizar Cadastro
                    <CheckCircle2 className="w-4 h-4" />
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
