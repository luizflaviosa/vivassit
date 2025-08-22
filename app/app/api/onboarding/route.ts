
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simulate N8N webhook integration
    const webhookUrl = 'https://n8n.vivativa.com.br/webhook/onboarding'; // Replace with actual N8N webhook URL
    
    const payload = {
      timestamp: new Date().toISOString(),
      source: 'vivativa-onboarding',
      data: {
        doctor: body?.doctor ?? {},
        qualifications: body?.qualifications ?? [],
        metadata: {
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        }
      }
    };

    // In production, make actual webhook call
    // const webhookResponse = await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(payload)
    // });

    // For now, just log the data
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
    message: 'API de onboarding Vivativa ativa',
    timestamp: new Date().toISOString()
  });
}
