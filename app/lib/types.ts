
export interface DoctorData {
  name: string;
  specialty: string;
  crm: string;
  email: string;
  clinic: {
    name: string;
    email: string;
    type: string;
  };
  consultation: {
    duration: number;
    plan: string;
  };
  progress: number;
}

export interface ValueBlock {
  icon: string;
  title: string;
  description: string;
}

export interface QualificationOption {
  id: string;
  label: string;
  selected: boolean;
}
