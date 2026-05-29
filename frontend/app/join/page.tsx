"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import RoleAwareNav from "../components/RoleAwareNav";
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
      
      // Convert image to base64 if it exists
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
    <main className="min-h-screen bg-white text-[#171d2a]">
      <section className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Link
            href="/"
            className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]"
          >
            Stitch
          </Link>
          <RoleAwareNav />
        </header>

        <section className="px-5 py-12 sm:px-8 md:px-14 md:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <h1 className="text-[40px] font-bold text-[#202635] sm:text-[48px]">
                Join Stitch
              </h1>
              <p className="mt-4 text-lg text-[#4b5563]">
                Become part of our community of skilled tailors and designers
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Form Section */}
              <div className="rounded-lg border border-[#e5e7eb] bg-white p-8 shadow-sm">
                <h2 className="mb-6 text-2xl font-bold text-[#202635]">
                  Tell us about yourself
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[#202635]">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="Enter your first name"
                      className="mt-2 w-full rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-[#171d2a] placeholder:text-[#9ca3af] focus:border-[#d779f4] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#202635]">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Enter your last name"
                      className="mt-2 w-full rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-[#171d2a] placeholder:text-[#9ca3af] focus:border-[#d779f4] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#202635]">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your email address"
                      className="mt-2 w-full rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-[#171d2a] placeholder:text-[#9ca3af] focus:border-[#d779f4] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#202635]">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      placeholder="+91 98765 43210"
                      className="mt-2 w-full rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-[#171d2a] placeholder:text-[#9ca3af] focus:border-[#d779f4] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#202635]">
                      Experience Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      className="mt-2 w-full rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-[#171d2a] focus:border-[#d779f4] focus:outline-none"
                    >
                      <option value="">Select experience level</option>
                      <option value="beginner">Beginner (0-2 years)</option>
                      <option value="intermediate">
                        Intermediate (2-5 years)
                      </option>
                      <option value="advanced">Advanced (5-10 years)</option>
                      <option value="expert">Expert (10+ years)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#202635]">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Enter your city/location"
                      className="mt-2 w-full rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-[#171d2a] placeholder:text-[#9ca3af] focus:border-[#d779f4] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#202635]">
                      Upload Your Work Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="mt-2 w-full rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-[#171d2a] file:rounded file:border-0 file:bg-[#d779f4] file:px-4 file:py-1 file:text-white file:font-medium"
                    />
                    <p className="mt-1 text-xs text-[#6b7280]">
                      PNG, JPG or GIF (max. 5MB)
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-6 w-full rounded-lg bg-[#d779f4] px-6 py-3 font-semibold text-[#151320] shadow-sm hover:bg-[#c65fe5] disabled:opacity-60"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </button>
                </form>
              </div>

              {/* Image Section */}
              <div className="flex flex-col">
                {imagePreview ? (
                  <div className="relative mb-4 h-64 overflow-hidden rounded-lg bg-[#f3f4f6]">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="mb-4 h-64 overflow-hidden rounded-lg bg-[#f3f4f6]">
                    <Image
                      src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=500&q=80"
                      alt="Tailor working"
                      width={500}
                      height={500}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-6">
                  <h3 className="font-semibold text-[#202635]">
                    Why join Stitch?
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm text-[#4b5563]">
                    <li>✓ Steady stream of bookings</li>
                    <li>✓ Flexible working schedule</li>
                    <li>✓ Competitive earnings</li>
                    <li>✓ Professional support team</li>
                    <li>✓ Grow your customer base</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
