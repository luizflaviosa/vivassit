
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // N8N webhook integration
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook/onboarding';
    
    const payload = {
      timestamp: new Date().toISOString(),
      source: 'medical-onboarding',
      data: {
        real_phone: body?.real_phone ?? '',
        clinic_name: body?.clinic_name ?? '',
        admin_email: body?.admin_email ?? '',
        doctor_name: body?.doctor_name ?? '',
        doctor_crm: body?.doctor_crm ?? '',
        speciality: body?.speciality ?? '',
        consultation_duration: body?.consultation_duration ?? '',
        establishment_type: body?.establishment_type ?? '',
        plan_type: body?.plan_type ?? '',
        qualifications: body?.qualifications ?? [],
        metadata: {
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        }
      }
    };

    // In production, make actual webhook call
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!webhookResponse.ok) {
        console.error('Webhook call failed:', webhookResponse.statusText);
      }
    } catch (webhookError) {
      console.error('Webhook error:', webhookError);
      // Continue execution even if webhook fails
    }

    // Log the data
    console.log('Onboarding data received:', payload);

    return NextResponse.json({ 
      success: true, 
      message: 'Dados enviados com sucesso',
      timestamp: payload.timestamp 
    });

  } catch (error) {
    console.error('Erro no webhook de onboarding:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'API de onboarding médico ativa',
    timestamp: new Date().toISOString()
  });
}
