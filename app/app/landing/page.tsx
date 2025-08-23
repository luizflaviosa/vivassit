
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  ArrowRight, 
  CheckCircle2, 
  Star,
  Users,
  TrendingUp,
  Clock,
  Shield,
  Zap,
  Heart,
  Award,
  BarChart3,
  Calendar,
  MessageCircle,
  CreditCard,
  Smartphone,
  Globe,
  User
} from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Dr. Ana Carolina',
    specialty: 'Cardiologia',
    clinic: 'CardioVida',
    image: '/avatars/dr-ana.jpg',
    rating: 5,
    text: 'Reduzi 40% do tempo administrativo. Agora foco 100% nos meus pacientes.',
  },
  {
    name: 'Dr. Roberto Silva',
    specialty: 'Ortopedia',  
    clinic: 'Centro Ortopédico',
    image: '/avatars/dr-roberto.jpg',
    rating: 5,
    text: 'Minhas consultas aumentaram 60% desde que comecei a usar a Vivassit.',
  },
  {
    name: 'Dra. Mariana Costa',
    specialty: 'Dermatologia',
    clinic: 'DermaCare',  
    image: '/avatars/dra-mariana.jpg',
    rating: 5,
    text: 'A melhor decisão que tomei para minha clínica. ROI em menos de 30 dias.',
  }
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Agenda Inteligente',
    description: 'IA que otimiza horários e reduz faltas em até 60%',
    benefit: 'Mais consultas',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Integrado',
    description: 'Comunicação automática com lembretes e confirmações',
    benefit: 'Zero stress',
  },
  {
    icon: CreditCard,
    title: 'Pagamentos Seguros',
    description: 'Receba PIX, cartão e parcelamento automaticamente',
    benefit: 'Mais receita',
  },
  {
    icon: BarChart3,
    title: 'Relatórios Inteligentes',
    description: 'Insights que mostram onde crescer e otimizar',
    benefit: 'Mais lucro',
  },
  {
    icon: Shield,
    title: '100% Seguro',
    description: 'LGPD, criptografia e backups automáticos',
    benefit: 'Tranquilidade',
  },
  {
    icon: Smartphone,
    title: 'Mobile First',
    description: 'App nativo para você e seus pacientes',
    benefit: 'Praticidade',
  },
];

const PRICING_PLANS = [
  {
    name: 'Starter',
    price: 97,
    popular: false,
    features: [
      'Até 100 pacientes',
      'Agenda básica',
      'WhatsApp simples',
      'Suporte email',
    ],
  },
  {
    name: 'Professional',
    price: 197,
    popular: true,
    features: [
      'Pacientes ilimitados',
      'IA completa',
      'WhatsApp Business',
      'Pagamentos integrados',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
  },
  {
    name: 'Enterprise',
    price: 397,
    popular: false,
    features: [
      'Múltiplas clínicas',
      'API personalizada',
      'Integrações ilimitadas',
      'Gerente dedicado',
      'Treinamento exclusivo',
      'Suporte 24/7',
    ],
  },
];

export default function LandingPage() {
  const [todaySignups, setTodaySignups] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successTenantId, setSuccessTenantId] = useState('');

  // Check for success parameters in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('success');
    const tenantParam = urlParams.get('tenant');
    
    if (successParam === 'true') {
      setShowSuccessMessage(true);
      setSuccessTenantId(tenantParam || '');
      
      // Auto-hide success message after 10 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 10000);
    }
  }, []);

  // Animate counters
  useEffect(() => {
    const signupTarget = 89;
    const usersTarget = 5247;
    
    const signupTimer = setInterval(() => {
      setTodaySignups(prev => {
        const increment = Math.ceil((signupTarget - prev) / 15);
        return prev + increment < signupTarget ? prev + increment : signupTarget;
      });
    }, 100);

    const usersTimer = setInterval(() => {
      setTotalUsers(prev => {
        const increment = Math.ceil((usersTarget - prev) / 25);
        return prev + increment < usersTarget ? prev + increment : usersTarget;
      });
    }, 80);

    return () => {
      clearInterval(signupTimer);
      clearInterval(usersTimer);
    };
  }, []);

  // Rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleStartTrial = () => {
    // Navigate to onboarding
    window.location.href = '/onboarding';
  };

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10">
        {/* Success Message */}
        <AnimatePresence>
          {showSuccessMessage && (
            <motion.div
              className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-2xl"
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-2xl shadow-2xl border border-green-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold">🎉 Cadastro Realizado com Sucesso!</h3>
                  <button 
                    onClick={() => setShowSuccessMessage(false)}
                    className="ml-auto text-white/80 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-green-50 mb-2">
                  Sua conta Vivassit foi criada e nosso time já iniciou a configuração da sua clínica.
                </p>
                {successTenantId && (
                  <p className="text-sm text-green-100 bg-green-600/30 px-3 py-1 rounded-full inline-block">
                    <strong>ID do Tenant:</strong> {successTenantId}
                  </p>
                )}
                <p className="text-xs text-green-100 mt-3 opacity-90">
                  📧 Verifique seu email nos próximos minutos para instruções de acesso.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="logo-container">
            <Image
              src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
              alt="Vivassit"
              width={160}
              height={50}
              className="h-10 w-auto"
              priority
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="stats-counter px-4 py-2 rounded-full text-sm font-semibold">
              +{todaySignups} hoje
            </div>
            <button 
              onClick={handleStartTrial}
              className="cta-secondary px-6 py-2 rounded-full font-semibold transition-all duration-300 hover:scale-105"
            >
              Entrar
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="hero-badge inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-medium text-sm mb-8">
              <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
              <span>Mais de {totalUsers.toLocaleString()} médicos confiam na Vivassit</span>
              <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-800 mb-6 leading-tight">
              Sua clínica
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent"> automatizada</span>
              <br />
              em 5 minutos
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              A única plataforma que <strong>transforma consultórios tradicionais</strong> em clínicas modernas,  
              <strong> lucrativas e eficientes</strong>. Sem complicação.
            </p>

            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-12">
              <motion.button
                onClick={handleStartTrial}
                className="cta-primary text-white px-8 py-4 rounded-2xl text-lg font-bold inline-flex items-center gap-3 hover:scale-105 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Começar Teste Grátis
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              
              <div className="flex items-center gap-4 text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">7 dias grátis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Sem cartão</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Cancele quando quiser</span>
                </div>
              </div>
            </div>

            {/* Social Proof Numbers */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800 mb-2">+5.247</div>
                <div className="text-gray-600">Médicos ativos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800 mb-2">98%</div>
                <div className="text-gray-600">Satisfação</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800 mb-2">4.9★</div>
                <div className="text-gray-600">Avaliação média</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800 mb-2">60%</div>
                <div className="text-gray-600">Menos faltas</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
              Tudo que sua clínica precisa
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"> em um só lugar</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Pare de usar 10 sistemas diferentes. A Vivassit unifica tudo: agenda, pagamentos, comunicação e relatórios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="feature-card p-8 rounded-3xl text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  {feature.benefit}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Testimonial Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-6">
              Médicos que <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">transformaram</span> suas práticas
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial}
                className="testimonial-card p-8 rounded-3xl text-center"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <p className="text-xl text-gray-700 mb-8 italic">
                  "{TESTIMONIALS[currentTestimonial].text}"
                </p>
                
                <div className="flex items-center justify-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-800">{TESTIMONIALS[currentTestimonial].name}</div>
                    <div className="text-gray-600">{TESTIMONIALS[currentTestimonial].specialty}</div>
                    <div className="text-sm text-gray-500">{TESTIMONIALS[currentTestimonial].clinic}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center mt-8 gap-2">
              {TESTIMONIALS.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentTestimonial 
                      ? 'bg-purple-500' 
                      : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-6">
              Escolha o plano ideal para <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">sua clínica</span>
            </h2>
            <p className="text-xl text-gray-600">
              7 dias grátis em qualquer plano. Sem compromisso, sem burocracy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_PLANS.map((plan, index) => (
              <motion.div
                key={plan.name}
                className={`pricing-card p-8 rounded-3xl ${plan.popular ? 'featured' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                {plan.popular && (
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center py-2 px-4 rounded-full text-sm font-semibold mb-6 -mt-4">
                    Mais Popular
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold text-gray-800 mb-6">
                  R$ {plan.price}<span className="text-lg text-gray-500">/mês</span>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handleStartTrial}
                  className={`w-full py-4 rounded-2xl font-bold transition-all duration-300 ${
                    plan.popular
                      ? 'cta-primary text-white hover:scale-105'
                      : 'cta-secondary hover:scale-105'
                  }`}
                >
                  Começar Teste Grátis
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-4 py-20 text-center">
          <motion.div
            className="glass-card max-w-4xl mx-auto p-12 rounded-3xl"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
              Pronto para <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">transformar</span> sua clínica?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Junte-se a mais de 5.000 médicos que já automatizaram suas práticas e aumentaram a receita.
            </p>
            
            <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
              <motion.button
                onClick={handleStartTrial}
                className="cta-primary text-white px-12 py-5 rounded-2xl text-xl font-bold inline-flex items-center gap-3 hover:scale-105 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Começar Agora - É Grátis
                <ArrowRight className="w-6 h-6" />
              </motion.button>
              
              <div className="text-gray-500 text-sm">
                ⏰ Últimas {89 - todaySignups} vagas hoje<br />
                ✅ Sem cartão • ✅ 7 dias grátis • ✅ Suporte incluso
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 border-t border-white/20">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="logo-container mb-4 md:mb-0">
              <Image
                src="https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png"
                alt="Vivassit"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
            </div>
            <div className="text-gray-500 text-sm">
              © 2024 Vivassit. Transformando práticas médicas.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
