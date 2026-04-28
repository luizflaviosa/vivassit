#!/usr/bin/env python3
"""
Testa credenciais SMTP do SES diretamente contra a AWS.
Uso: python3 scripts/test-ses-smtp.py
Ele pergunta as credenciais (não fica nada salvo em arquivo).
"""
import smtplib
import sys
import getpass
import ssl
from email.mime.text import MIMEText

print("\n=== Teste SES SMTP direto ===\n")

host = input("Host [email-smtp.us-east-1.amazonaws.com]: ").strip() or "email-smtp.us-east-1.amazonaws.com"
port_input = input("Port [587]: ").strip() or "587"
port = int(port_input)
username = input("SMTP Username (começa com AKIA...): ").strip()
password = getpass.getpass("SMTP Password: ").strip()
sender = input("From email (identidade verificada no SES): ").strip()
to_email = input("Destinatário (em sandbox tem que estar verificado): ").strip()

print(f"\n→ Conectando em {host}:{port}...")

try:
    if port == 465:
        ctx = ssl.create_default_context()
        server = smtplib.SMTP_SSL(host, port, context=ctx, timeout=15)
    else:
        server = smtplib.SMTP(host, port, timeout=15)
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()

    server.set_debuglevel(1)  # mostra protocolo SMTP completo

    print("\n→ Tentando AUTH LOGIN...\n")
    server.login(username, password)
    print("\n✅ AUTH OK — credenciais SMTP aceitas pela AWS\n")

    print("→ Enviando email de teste...\n")
    msg = MIMEText("Teste SES SMTP — se vc tá lendo isso, está funcionando.")
    msg["Subject"] = "Teste SES Singulare"
    msg["From"] = sender
    msg["To"] = to_email
    server.sendmail(sender, [to_email], msg.as_string())
    print(f"\n✅ EMAIL ENVIADO para {to_email}\n")
    server.quit()

except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ AUTH FALHOU ({e.smtp_code}): {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error}")
    print("\nCausas comuns:")
    print(" - Username/password copiados errados (espaço extra, quebra de linha)")
    print(" - Você gerou IAM access key e usou aqui (precisa SMTP credentials, são diferentes)")
    print(" - IAM user não tem policy ses:SendRawEmail")
    print(" - Credenciais geradas em outra região (ex: us-east-2 mas host us-east-1)")
    sys.exit(1)
except smtplib.SMTPSenderRefused as e:
    print(f"\n⚠️  SENDER REJEITADO ({e.smtp_code}): {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error}")
    print("Auth funcionou mas o sender '{0}' não está verificado no SES da us-east-1.".format(sender))
    sys.exit(2)
except smtplib.SMTPRecipientsRefused as e:
    print(f"\n⚠️  DESTINATÁRIO REJEITADO: {e.recipients}")
    print("Auth/sender ok. Em sandbox SES, todo destinatário precisa estar verificado.")
    sys.exit(3)
except Exception as e:
    print(f"\n❌ Erro inesperado: {type(e).__name__}: {e}")
    sys.exit(99)
