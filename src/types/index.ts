export interface Criteria {
  name: string;
  maxScore: number;
  desc: string;
}

export interface StudentData {
  id: string;
  name: string;
  accessCode: string;
  scores: Record<string, number>;
  feedback: string;
  status: 'unviewed' | 'viewed' | 'confirmed' | 'disputed';
  disputeMessage?: string;
  updatedAt?: string;
}

export interface EventData {
  id: string;
  title: string;
  createdAt: string;
  criteria: Criteria[];
  students: StudentData[];
}
