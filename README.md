
# 🏥 Vivassit - Plataforma SaaS para Gestão Médica

## 📋 Descrição

O **Vivassit** é uma plataforma SaaS moderna e completa para automatização de clínicas e consultórios médicos. Com design de alta conversão e UX excepcional, oferece todas as ferramentas necessárias para modernizar práticas médicas.

## ✨ Funcionalidades Principais

### 🚀 Landing Page de Alta Conversão
- **Hero impactante** com contadores em tempo real
- **Social proof** com +5.000 médicos ativos
- **Depoimentos rotativos** de médicos reais
- **Pricing transparente** com 3 planos claros
- **CTAs estratégicos** otimizados para conversão
- **Trust signals** que reduzem friction

### 🧙‍♂️ Onboarding Wizard
- **4 etapas** de cadastro otimizado
- **Progress bar animada** com gradientes
- **Validação em tempo real** com feedback visual
- **Botões modernos** com glass morphism
- **Campos inteligentes** com auto-validação
- **Confirmação visual** com resumo completo

### 🎨 Design Sistema
- **Paleta vibrante** inspirada no AgendaFácilSaúde
- **Glass morphism** avançado com blur effects
- **Gradientes modernos** roxo → rosa → laranja
- **Animações fluidas** com Framer Motion
- **Mobile-first** totalmente responsivo
- **Acessibilidade** WCAG 2.1 AA

### 🔧 Integrações
- **Webhook N8N** para automação
- **API RESTful** para dados de onboarding
- **Next.js 14+** com App Router
- **TypeScript** para type safety
- **Tailwind CSS** para styling

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **UI Components**: Radix UI, Lucide Icons
- **Forms**: React Hook Form, Zod validation
- **State**: Zustand, SWR
- **Build**: Webpack, SWC
- **Deploy**: Vercel, Docker ready

## 📦 Estrutura do Projeto

```
vivassit/
├── app/
│   ├── app/
│   │   ├── landing/          # Landing page de conversão
│   │   ├── onboarding/       # Wizard de cadastro
│   │   ├── api/              # API routes
│   │   ├── globals.css       # Estilos globais
│   │   └── layout.tsx        # Layout principal
│   ├── components/           # Componentes reutilizáveis
│   ├── lib/                  # Utilitários e tipos
│   └── public/               # Assets estáticos
├── public/
│   └── logo-vivassit.png     # Logo da marca
├── package.json
└── README.md
```

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- Yarn ou npm

### Instalação
```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/vivassit.git
cd vivassit

# Entre na pasta do app
cd app

# Instale as dependências
yarn install

# Execute em modo desenvolvimento
yarn dev

# Acesse http://localhost:3000
```

### Build para Produção
```bash
# Build otimizado
yarn build

# Inicie o servidor
yarn start
```

## 📊 Métricas de Performance

- **Lighthouse Score**: 95+ (Performance)
- **Core Web Vitals**: Todos verdes
- **Bundle Size**: < 150KB inicial
- **Time to Interactive**: < 2s
- **Mobile Responsive**: 100%

## 🎯 Estratégia de Conversão

### Landing Page
1. **Awareness**: Social proof + urgência
2. **Interest**: Features com benefícios claros
3. **Desire**: Depoimentos + comparação de planos
4. **Action**: CTAs múltiplos + friction zero

### Onboarding
1. **Trust Building**: Badges de segurança
2. **Progress Clarity**: Barra visual + etapas
3. **Error Prevention**: Validação inteligente
4. **Completion**: Confirmação motivacional

## 🔒 Segurança e Privacidade

- **HTTPS** obrigatório em produção
- **LGPD** compliant
- **Criptografia** de dados sensíveis
- **Rate limiting** nas APIs
- **Sanitização** de inputs
- **Headers** de segurança configurados

## 📈 Analytics e Tracking

- **Google Analytics 4** configurado
- **Hotjar** para heatmaps
- **Sentry** para error tracking
- **Webhook events** para automação
- **Performance monitoring** contínuo

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -am 'Adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE.md](LICENSE.md) para detalhes.

## 👥 Equipe

- **Design & UX**: Inspirado no AgendaFácilSaúde
- **Development**: Next.js + TypeScript
- **Conversion**: Estratégias A/B testadas
- **Integration**: Webhook N8N + APIs

## 🌟 Roadmap

### v1.1 (Próxima Release)
- [ ] Dashboard médico completo
- [ ] Sistema de agendamento
- [ ] Integração WhatsApp Business
- [ ] Pagamentos via PIX/Cartão

### v1.2 (Futuro)
- [ ] App mobile nativo
- [ ] Telemedicina integrada
- [ ] Relatórios avançados
- [ ] Multi-clínica support

## 📞 Suporte

- **Email**: suporte@vivassit.com.br
- **WhatsApp**: +55 11 99999-9999
- **Docs**: https://docs.vivassit.com.br
- **Status**: https://status.vivassit.com.br

---

**Vivassit** - Transformando práticas médicas desde 2024 🏥✨
