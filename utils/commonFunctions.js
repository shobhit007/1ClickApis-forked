const { v4 } = require("uuid");

const getSubordinateMembers = async (memberId) => {
  try {
  } catch (error) {
    return [];
  }
};

const getUniqueId = () => Promise.resolve(v4());

module.exports = { getSubordinateMembers, getUniqueId };
