// const userRoles = [
//   { department: "management", hierarchy: ["superAdmin", "admin"] },
//   {
//     department: "sales",
//     hierarchy: ["manager", "executive"],
//   },
// ];

const userRoles = [
  {
    department: "management", hierarchy: ["superAdmin", "Director",
      'Founder & CEO',
      "Co - Founder & COO",
      "Chief Financial Officer",
      "Chief Strategy Officer",
      "Complaince Officer",
      "General Manager",
      "Assistant General Manager"]
  },
  {
    department: "sales",
    hierarchy: ["Vice President",
      "Assistant Vice President",
      "Branch Manager",
      "Manager",
      "Team Manager",
      "Assistant Manager",
      "Sr.Executive",
      "Executive",
      "Intern"],
  },
  {
    department: "Clients Service",
    hierarchy: [
      "Vice President",
      "Assistant Vice President",
      "Branch Manager",
      "Sr. Manager",
      "Manager",
      "Team Manager",
      "Customer Success Manager",
      "Sr. Executive",
      "Executive",
      "Intern"
    ]
  },
  {
    department: "Human Resource",
    hierarchy: [
      "HR Head",
      "Vice President",
      "Assistant Vice President",
      "Sr.Manager HR",
      "HR Manager",
      "Sr.Executive",
      "Executive",
      "Intern"
    ]
  },
  {
    department: "Accounts",
    hierarchy: [
      "Chief Financial Officer",
      "Vice President",
      "Assistant Vice President",
      "Sr. Manager",
      "Manager",
      "Executive",
      "Intern"
    ]
  },
  {
    department: "Technology",
    hierarchy: [
      "IT Head",
      "Vice President",
      "Assistant Vice President",
      "Product Manager",
      "Manager Web Development",
      "Web Developer",
      "Wordpress Developer",
      "MIS Manager",
      "MIS Executive",
      "Manager Digital Marketing",
      "Social Media Marketing Manager",
      "Social Media Marketing Executive",
      "Manager Graphic Design",
      "Graphic Design Executive",
      "Intern"
    ]
  },
  {
    department: "Administration",
    hierarchy: [
      "Admin Head",
      "Sr.Manager",
      "Manager",
      "Executive",
      "Housekeeping Manager",
      "House Keeping Executive"
    ]
  }
];

module.exports = { userRoles };
