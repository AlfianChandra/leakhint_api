export const useValidator = () => {
  const validateName = (str) => {
    if (!str) {
      return {
        result: false,
        message: "Nama tidak boleh kosong.",
      };
    }
    const regex = /^[a-zA-Z ]{3,30}$/; // Name must be 2-30 characters long and only contain letters and spaces
    return {
      result: regex.test(str),
      message:
        "Nama hanya boleh mengandung huruf dan spasi, serta harus antara 3-30 karakter.",
    };
  };
  const validateEmail = (str) => {
    if (!str) {
      return {
        result: false,
        message: "E-mail tidak boleh kosong.",
      };
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Email must be a valid email format
    return { result: regex.test(str), message: "Format email tidak valid." };
  };

  const validatePassword = (str) => {
    if (!str) {
      return {
        result: false,
        message: "Password tidak boleh kosong.",
      };
    }
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/; // Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, and one number
    return {
      result: regex.test(str),
      message:
        "Password harus terdiri dari minimal 8 karakter, termasuk huruf besar, huruf kecil, dan angka.",
    };
  };

  const validatePhone = (str) => {
    if (!str) {
      return {
        result: false,
        message: "Nomor telepon tidak boleh kosong.",
      };
    }
    const regex = /^628\d{8,12}$/; // Phone must obey this format: 6289698926910
    return {
      result: regex.test(str),
      message:
        "Format nomor telepon tidak valid. Harus dimulai dengan 628 diikuti 8-12 digit.",
    };
  };
  return { validateName, validateEmail, validatePassword, validatePhone };
};

export default useValidator;
