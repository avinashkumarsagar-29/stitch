"use client";

import Image from "next/image";
import { useState } from "react";
import { showToast } from "../components/Toast";

export default function JoinPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    experience: "",
    location: "",
    image: null as File | null,
  });
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phoneNumber ||
      !formData.experience ||
      !formData.location
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      let imageData = null;
      const image = formData.image;
      if (image) {
        imageData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(image);
        });
      }

      const response = await fetch(`${apiUrl}/api/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          experience: formData.experience,
          location: formData.location,
          image: imageData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to submit application", "error");
        return;
      }

      showToast(data.message, "success");
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        experience: "",
        location: "",
        image: null,
      });
      setImagePreview("");
    } catch (error) {
      showToast("Unable to connect to backend server", "error");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="p-4 md:p-8 lg:p-10 bg-gray-50/50 min-h-screen font-sans">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        {/* Top color accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center md:text-left space-y-3">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                ✨ Career Center
              </span>
            </div>
            <h1 className="font-serif text-[30px] font-extrabold tracking-tight text-gray-900 sm:text-[38px]">
              Join Stitch
            </h1>
            <p className="text-xs text-gray-500 max-w-[540px]">
              Become part of our community of skilled tailors and designers. Grow your business and reach more clients.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Form Section */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-6 md:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Tell us about yourself
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormInput
                    label="First Name"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    required
                  />
                  <FormInput
                    label="Last Name"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    required
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormInput
                    label="Email Address"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email address"
                    required
                  />
                  <FormInput
                    label="Phone Number"
                    name="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-2">
                      Experience Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      required
                      className="w-full h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 outline-none focus:border-[#c322f4] focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
                    >
                      <option value="">Select level</option>
                      <option value="beginner">Beginner (0-2 years)</option>
                      <option value="intermediate">Intermediate (2-5 years)</option>
                      <option value="advanced">Advanced (5-10 years)</option>
                      <option value="expert">Expert (10+ years)</option>
                    </select>
                  </div>

                  <FormInput
                    label="Location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="City/location"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-2">
                    Upload Your Work Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full h-12 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-[#d779f4] file:px-4 file:py-1 file:text-white file:font-semibold cursor-pointer"
                  />
                  <p className="mt-1.5 text-[10px] text-gray-400">
                    PNG, JPG or GIF (max. 5MB)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-3 font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </button>
              </form>
            </div>

            {/* Image & Perks Section */}
            <div className="flex flex-col space-y-6">
              {imagePreview ? (
                <div className="relative h-[280px] overflow-hidden rounded-xl bg-gray-50 border border-gray-100 shadow-inner">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    unoptimized
                    className="object-cover rounded-xl"
                  />
                </div>
              ) : (
                <div className="relative h-[280px] overflow-hidden rounded-xl bg-gray-50 border border-gray-100 shadow-inner">
                  <Image
                    src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=500&q=80"
                    alt="Tailor working"
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover rounded-xl"
                  />
                </div>
              )}

              <div className="rounded-xl border border-gray-100 bg-[#f9fafb] p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d2a22e]" />
                  Why join Stitch?
                </h3>
                <ul className="mt-4 space-y-3 text-xs text-gray-500">
                  <li className="flex items-center gap-2">
                    <span className="text-[#c322f4] font-bold">✓</span> Steady stream of bookings
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#c322f4] font-bold">✓</span> Flexible working schedule
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#c322f4] font-bold">✓</span> Competitive earnings
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#c322f4] font-bold">✓</span> Professional support team
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#c322f4] font-bold">✓</span> Grow your customer base
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FormInput({
  label,
  name,
  value,
  placeholder,
  type = "text",
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        suppressHydrationWarning
        className="w-full h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm placeholder-gray-400 outline-none focus:border-[#c322f4] focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
      />
    </div>
  );
}
