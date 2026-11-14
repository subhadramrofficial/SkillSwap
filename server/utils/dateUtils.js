/**
 * Date and age calculation utilities
 */

/**
 * Calculates accurate age in full years from a date of birth
 * @param {Date|string} dateOfBirth - The user's birthdate
 * @returns {number} Age in full years
 */
function calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);
  if (isNaN(birthDate.getTime())) {
    return -1;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

module.exports = {
  calculateAge,
};
