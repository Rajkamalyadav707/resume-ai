export type Job = {
  title?: string;
  company?: string;
  location?: string;
  description: string;
  url?: string;
};
export type Analysis = {
  matchScore: number;
  atsScore: number;
  summary: string;
  matchingSkills: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  experienceAlignment: string;
  educationAlignment: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  sectionAnalysis: {
    summary: string;
    experience: string;
    skills: string;
    education: string;
    projects: string;
  };
};
export type Resume = {
  name: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    credly: string;
  };
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  certifications: string[];
};
export type Experience = {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
};
export type Education = {
  institution: string;
  degree: string;
  location?: string;
  graduationDate?: string;
  details?: string[];
};
export type Project = { name: string; link?: string; bullets: string[] };
export type Step = 1 | 2 | 3 | 4 | 5;
export type ChatMessage = { role: "user" | "assistant"; content: string };
