export interface CostBreakdown {
  inState: number | null;
  outOfState: number | null;
}

export interface FinancialAid {
  tuition: CostBreakdown;
  fees: CostBreakdown;
  roomAndBoard: CostBreakdown;
  books: CostBreakdown;
  total: CostBreakdown;
}

export interface TestScore {
  p25: number | null;
  mid: number | null;
  p75: number | null;
}

export interface College {
  id: string; // The primary key (often the scorecard ID)
  name: string;
  city: string;
  state: string;
  location: string;
  isPublic: boolean;
  acceptanceRate: number | null;
  isTestOptional: boolean;
  averageGpa: number | null;
  averageGpaWeighted: number | null;
  
  // Financial Aid
  offersNeedBasedAid: boolean;
  isNeedBlind: boolean | null;
  isNeedAware: boolean | null;
  financialAid?: FinancialAid;

  // Deadlines
  offersEarlyAdmission: boolean | null;
  isEstimatedDeadlines: boolean | null;
  deadlines: {
    earlyDecision1: string | null;
    earlyDecision2: string | null;
    earlyAction: string | null;
    regularDecision: string | null;
    rolling: boolean | null;
  };

  testScores?: {
    satReading: TestScore;
    satMath: TestScore;
    actComposite: TestScore;
    actEnglish: TestScore;
    actMath: TestScore;
  };

  isHumanVerified: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  
  // Profile questionnaire fields mapped from Questons.md & designs/profile.html
  fullName?: string;
  dob?: string; // YYYY-MM-DD
  zipCode?: string;
  educationLevel?: 'HS Freshman' | 'HS Sophomore' | 'HS Junior' | 'HS Senior' | 'Other'; // From Question 2
  applyStatePreference?: 'In-state' | 'Out of state' | 'Both'; // From Question 4
  oosStatesConsidered?: string; // From Question 5
  isFirstGen?: boolean; // From Question 6
  isUrm?: boolean; // From Question 7
  isLegacy?: boolean; // From Question 8
  seekingFinAid?: 'Yes' | 'No' | 'Don\'t know'; // From Question 9
  seekingMeritAid?: 'Yes' | 'No' | 'Don\'t know'; // From Question 10
  workingWithConsultant?: 'Yes' | 'No' | 'Don\'t know'; // From Question 11
  gpa4?: number; // Question 12 (unweighted 4.0 scale)
  gpa5?: number; // Question 13 (unweighted 5.0 scale)
  planToSubmitScores?: 'Yes' | 'No' | 'Don\'t know'; // Question 14
  satScore?: '1450-1600' | '1300-1449' | '1200-1299' | '1000-1199' | 'NA'; // Question 15
  actScore?: '33-36' | '28-32' | '25-27' | '19-24' | 'NA'; // Question 16

  mySchools?: string[]; // Array of college IDs
  profileCompleteness?: number; // 0-100 percentage
  hasSeenIntro?: boolean;
  hasSeenCongrats?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
