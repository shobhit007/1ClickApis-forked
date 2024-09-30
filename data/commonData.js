const userRoles = [
  { department: "management", hierarchy: ["superAdmin", "admin"] },
  {
    department: "sales",
    hierarchy: [
      "teamLead",
      "assistantManager",
      "manager",
      "GM/AVP",
      "VP",
      "director",
      "member",
    ],
  },
  {
    department: "service",
    hierarchy: ["CRMhead"],
  },
];

module.exports = { userRoles };
