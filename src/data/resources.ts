export type ResourceType = "clinic" | "ngo" | "alert";

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  description: string;
  location: string;
  contact?: string;
  tags: string[];
  date?: string;
}

export const resources: Resource[] = [
  // Clinics
  { id: "c1", type: "clinic", name: "Sunrise Community Clinic", description: "Free general health check-ups, vaccinations, and maternal care.", location: "Westside, District 4", contact: "+1 555-0101", tags: ["health", "vaccination", "maternal", "free"] },
  { id: "c2", type: "clinic", name: "HopeCare Family Clinic", description: "Affordable pediatric and dental services for low-income families.", location: "Eastside, District 2", contact: "+1 555-0102", tags: ["pediatric", "dental", "family"] },
  { id: "c3", type: "clinic", name: "GreenLeaf Mental Health Center", description: "Counseling, therapy, and crisis support — sliding-scale fees.", location: "Downtown, District 1", contact: "+1 555-0103", tags: ["mental health", "counseling", "therapy"] },
  { id: "c4", type: "clinic", name: "Riverside Mobile Clinic", description: "Mobile health unit visiting underserved neighborhoods weekly.", location: "Mobile / Various", contact: "+1 555-0104", tags: ["mobile", "general"] },

  // NGOs
  { id: "n1", type: "ngo", name: "Youth Rise Foundation", description: "Mentorship, scholarships, and after-school programs for teens.", location: "District 3", contact: "info@youthrise.org", tags: ["youth", "education", "mentorship"] },
  { id: "n2", type: "ngo", name: "FoodShare Network", description: "Weekly food distribution and community kitchen for families in need.", location: "Citywide", contact: "+1 555-0201", tags: ["food", "hunger", "family"] },
  { id: "n3", type: "ngo", name: "Shelter Together", description: "Emergency housing and transitional support for the unhoused.", location: "District 5", contact: "+1 555-0202", tags: ["housing", "shelter", "emergency"] },
  { id: "n4", type: "ngo", name: "Women Empower Collective", description: "Legal aid, vocational training, and safe spaces for women.", location: "District 1", contact: "help@wempower.org", tags: ["women", "legal", "training"] },

  // Alerts
  { id: "a1", type: "alert", name: "Scheduled Power Outage", description: "Grid maintenance in District 4 from 9am–2pm Saturday.", location: "District 4", date: "2026-05-09", tags: ["power", "outage", "utility"] },
  { id: "a2", type: "alert", name: "Water Service Interruption", description: "Pipe repair affecting Eastside until Tuesday evening.", location: "District 2", date: "2026-05-05", tags: ["water", "utility"] },
  { id: "a3", type: "alert", name: "Free Vaccination Drive", description: "Flu shots available at Sunrise Clinic — walk-ins welcome.", location: "Westside", date: "2026-05-10", tags: ["health", "vaccination", "event"] },
  { id: "a4", type: "alert", name: "Road Closure — Main Bridge", description: "Bridge closed for inspection through the weekend.", location: "Downtown", date: "2026-05-08", tags: ["road", "closure", "transit"] },
];

export const reviews: Record<string, { text: string }[]> = {
  c1: [
    { text: "Helpful staff and quick service, but the waiting room was crowded." },
    { text: "Friendly nurses, free vaccines for my kids. Very grateful." },
    { text: "Long queues on weekends but worth it for the free care." },
    { text: "Doctor was kind and patient. Clean facility." },
  ],
  c2: [
    { text: "Great pediatric care, my child loves Dr. Lee." },
    { text: "Affordable dental cleaning, friendly reception." },
    { text: "Wait time was long but staff was helpful." },
  ],
  c3: [
    { text: "Counselor was understanding and non-judgmental." },
    { text: "Sliding-scale fees made therapy accessible for me." },
    { text: "Helpful intake process, calm environment." },
  ],
  n1: [
    { text: "Amazing mentorship program for my teen." },
    { text: "Scholarship application was straightforward and helpful." },
    { text: "Staff is dedicated and caring." },
  ],
  n2: [
    { text: "Weekly food boxes saved our family during a hard time." },
    { text: "Long lines but the volunteers are kind and organized." },
    { text: "Fresh produce and friendly volunteers." },
  ],
  n3: [
    { text: "Got emergency shelter when I had nowhere else to go." },
    { text: "Crowded but the staff really care." },
    { text: "Helpful case workers, clean facility." },
  ],
};
