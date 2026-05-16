# Luxury Modular Intelligence v1.0 — placeholder

Este arquivo é um **placeholder temporário**. O brand book oficial da Singulare
("Luxury Modular Intelligence v1.0") existe como HTML completo no histórico
de outra conversa, mas o agente que criou o sistema paralelo **Editorial Warm**
(este diretório) não tinha acesso ao source HTML do v1.0 no momento da criação.

## O que falta

O arquivo `system-luxury-modular-v1.html` ainda **não existe** neste diretório.

## Como resolver

Escolha uma das opções:

**Opção 1 — colar o HTML manualmente (recomendado)**
1. Abre a conversa onde você gerou o brand book Luxury Modular Intelligence v1.0.
2. Copia o HTML completo do arquivo gerado.
3. Cria o arquivo `docs/brand/system-luxury-modular-v1.html` e cola o conteúdo.
4. `git add docs/brand/system-luxury-modular-v1.html`
5. `git commit -m "docs(brand): adiciona brand book Luxury Modular Intelligence v1.0"`
6. `git push origin main`
7. (Opcional) Apaga este placeholder: `git rm docs/brand/luxury-modular-v1-PLACEHOLDER.md`

**Opção 2 — pedir pra reconstruir**
Abra uma sessão nova do Claude e peça pra reconstruir o brand book v1.0
a partir do DNA: paleta navy escuro `#0F1B33` + gold `#FFC62F` + sand, logo
3 quadrados sobrepostos, tipografia Poppins Bold, conceito Luxury Modular
Intelligence. O agente pode espelhar a estrutura usada em
`system-editorial-warm-v1.html` deste mesmo diretório, trocando paleta,
tipografia e conceito.

## Por que isso importa

Sem o v1.0 versionado no repo, o sistema oficial da marca fica só na sua
máquina / na conversa antiga — e qualquer designer / IA que precise consultar
a referência canônica vai precisar pedir pra você manualmente. Versionar
ambos no `docs/brand/` deixa os dois sistemas auditáveis lado a lado.

## Referências cruzadas

- `system-editorial-warm-v1.html` — sistema paralelo, já criado.
- `email-welcome-editorial-warm.html` — aplicação canônica do Editorial Warm.
- `README.md` — index dos dois sistemas e quando usar cada um.
