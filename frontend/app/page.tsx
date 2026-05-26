import Image from "next/image";
import Link from "next/link";
import AuthActions from "./components/AuthActions";
import BookingForm from "./components/BookingForm";
import ProtectedLink from "./components/ProtectedLink";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About us", href: "/about" },
  { label: "Collection", href: "/collection" },
  { label: "Careers", href: "/careers" },
  { label: "Blog", href: "/blog" },
];

const workSteps = [
  {
    title: "Choose Destination",
    text: "enter your pickup and locations, and choose a stylish that suits you.",
    icon: "search",
  },
  {
    title: "Pick-up Location",
    text: "Start to track the stylish by entering your location point in the search bar",
    icon: "pin",
  },
  {
    title: "Your Destination",
    text: "Sit back and enjoyed, stylish do your work- on time and affordable prices.",
    icon: "flag",
  },
];

const services = [
  {
    title: "Sewing",
    image:
      "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-1 md:row-start-1",
  },
  {
    title: "Repair",
    image:
      "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-3 md:row-start-1 md:mt-4",
  },
  {
    title: "Stylish",
    image:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-2 md:row-start-2 md:-mt-8",
  },
  {
    title: "Alteration",
    image:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-1 md:row-start-3 md:-mt-4",
  },
  {
    title: "Tools",
    image:
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-3 md:row-start-3 md:-mt-5",
  },
];

const joinBenefits = [
  {
    title: "Customer Support",
    text: "Whether you're a stylish and customer, we've got your back. Our dedicated support team is here to assist you.",
    icon: "phone",
  },
  {
    title: "Transparent pricing",
    text: "No surprises, no hidden charges. Just affordable, reliable price every time.",
    icon: "tag",
  },
  {
    title: "Many Location",
    text: "Stitchy is available in 100+ cities across India-and we're growing fast! Wherever you go, an affordable design and craft is just a tap away.",
    icon: "pin",
  },
];

const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=900&q=80",
    alt: "Detailed embroidery work",
  },
  {
    src: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80",
    alt: "Tailors repairing fabric",
  },
];

const testimonials = [
  {
    name: "R. Anjali",
    place: "Bangalore",
    text: '"Stichy has completely changed my daily commute! It\'s fast, affordable, and I do not have to worry about traffic anymore."',
    rating: "4.5",
  },
  {
    name: "A. Mohan",
    place: "Delhi",
    text: '"The booking experience is smooth and the tailoring support is reliable. Highly recommended!"',
    rating: "4.5",
  },
  {
    name: "K Neha",
    place: "Pune, Maharashtra",
    text: '"Great service! My Styler was punctual and polite. I use stichy almost every day now."',
    rating: "4.5",
  },
];

const footerColumns = [
  {
    title: "About",
    links: ["How it works", "Featured", "Partnership", "Bussiness Relation"],
  },
  {
    title: "Community",
    links: ["Events", "Blog", "Podcast", "Invite a friend"],
  },
  {
    title: "Socials",
    links: ["Discord", "Instagram", "Twitter", "Facebook"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#171d2a]">
      <section className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Link href="/" className="flex items-end gap-2" aria-label="Stitch home">
            <span className="relative flex h-16 w-12 items-center justify-center text-5xl font-black leading-none text-[#0c1b24]">
              S
              <span className="absolute left-[29px] top-0 h-9 w-[3px] rounded-full bg-[#d2a22e]" />
              <span className="absolute left-[25px] top-0 h-9 w-5 rounded-full border-2 border-[#0c1b24] border-l-0" />
            </span>
            <span className="-ml-3 flex flex-col">
              <span className="text-[38px] font-black leading-8 tracking-tight text-[#071720]">
                titch
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7d8791]">
                Tailoring & Design
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-xs font-medium sm:text-sm md:justify-end md:gap-8">
            {navLinks.map((link, index) =>
              index === 0 ? (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[#121a28]"
                >
                  {link.label}
                </Link>
              ) : (
                <ProtectedLink
                  key={link.label}
                  href={link.href}
                  className=""
                >
                  {link.label}
                </ProtectedLink>
              ),
            )}
            <span className="h-6 w-px bg-[#9ca4ad]" />
            <AuthActions />
          </nav>
        </header>

        <section className="relative border-b border-[#b9c7d6]">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.93),rgba(255,255,255,.76)),url('https://tile.openstreetmap.org/12/2554/1693.png')] bg-cover bg-center opacity-95" />
          <div className="relative grid min-h-[540px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_minmax(320px,496px)] md:px-14 md:py-16 lg:px-14">
            <div className="flex max-w-[520px] flex-col justify-center">
              <h1 className="font-serif text-[28px] font-bold uppercase leading-[1.28] tracking-wide text-[#202635] sm:text-[34px] md:text-[38px]">
                With each stitch, we don&apos;t just sew clothes
                <br />
                -we sew culture, memory, and love.
              </h1>
              <p className="mt-4 max-w-[450px] pl-4 text-[13px] leading-6 text-[#111827] md:pl-4">
                With Stitchy, you get access to fast and affordable styler at
                your desire location.
              </p>
              <a
                href="#booking"
                className="mt-5 ml-4 w-fit rounded-[4lpx] bg-[#d779f4] px-8 py-3 text-sm font-medium text-[#151320]  shadow-sm"
              >
                Book Now
              </a>
            </div>

            <div className="relative min-h-[360px] overflow-hidden bg-[#d4d4d4] md:min-h-[470px]">
              <Image
                src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80"
                alt="Tailors working with fabric"
                width={900}
                height={780}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </section>

        <section id="booking" className="relative bg-[#f7f7f7] px-4 pb-10 pt-2 sm:px-6">
          <BookingForm />
        </section>

        <section className="bg-white px-5 pb-16 pt-14 sm:px-8 md:px-14 md:pb-24 md:pt-16">
          <div className="mx-auto max-w-[990px] text-center">
            <h2 className="text-[32px] font-extrabold leading-none tracking-tight text-[#202635] sm:text-[40px]">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-[1.45] text-[#222937]">
              Track ,book the appointment of stylish ed and just do that
              <br />
              there works.
            </p>

            <div className="relative mt-16 grid gap-14 md:grid-cols-3 md:gap-10">
              <Connector className="left-[15%] top-[44px]" />
              <Connector className="right-[15%] top-[44px]" />

              {workSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative flex h-[86px] w-[86px] items-center justify-center rounded-[22px] bg-[#c322f4]">
                    {index === 0 ? (
                      <span className="absolute -left-1 -top-1 h-8 w-[78px] rounded-full bg-[#ffe234]" />
                    ) : null}
                    <StepIcon icon={step.icon} />
                  </div>
                  <h3 className="mt-7 text-[21px] font-bold tracking-tight text-[#202635]">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-[245px] text-xs leading-6 text-[#2d3443]">
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f8f8f8] px-5 pb-16 pt-9 sm:px-8 md:px-16">
          <h2 className="text-center text-[30px] font-extrabold uppercase leading-none tracking-tight text-[#202635] underline decoration-[#d2a22e] decoration-2 underline-offset-2 sm:text-[38px]">
            Our Services
          </h2>

          <div className="mx-auto mt-14 grid max-w-[1030px] gap-x-12 gap-y-10 md:grid-cols-3 md:grid-rows-[auto_auto_auto]">
            {services.map((service) => (
              <ServiceCard
                key={`${service.title}-${service.image}`}
                {...service}
              />
            ))}
          </div>
        </section>

        <section className="bg-white px-5 pb-16 pt-10 sm:px-8 md:px-24 md:pb-20 md:pt-12">
          <div className="text-center">
            <a
              href="#booking"
              className="inline-flex rounded-[10px] bg-[#d779f4] px-5 py-3 text-[24px] font-medium leading-none text-[#171d2a]  shadow-sm"
            >
              Book Now
            </a>
          </div>

          <div className="mt-28 text-center">
            <h2 className="text-[34px] font-medium leading-none tracking-tight text-[#202635] sm:text-[44px]">
              Join Stitch
            </h2>
            <p className="mx-auto mt-4 max-w-[680px] text-[17px] leading-[1.35] text-[#202635] sm:text-[22px] sm:leading-[1.22]">
              Earn more on your schedule by joining India&apos;s leading Sewing
              platform.
              <br />
              No boss, no stress-just you, your craft and talents,
              <br />
              and the road to financial freedom.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-[1000px] items-center gap-10 md:mt-20 md:grid-cols-[minmax(280px,410px)_1px_1fr] md:gap-20">
            <div className="h-[385px] w-full overflow-hidden bg-[#d9d9d9]">
              <Image
                src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=820&q=80"
                alt="Tailor working on fabric"
                width={820}
                height={770}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="hidden h-[402px] w-[8px] rounded-full bg-[#c322f4] md:block" />

            <div className="space-y-9">
              {joinBenefits.map((benefit) => (
                <article key={benefit.title} className="flex gap-5">
                  <span className="flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-[7px] bg-[#c322f4] text-[#111827]">
                    <BenefitIcon icon={benefit.icon} />
                  </span>
                  <span>
                    <h3 className="text-[19px] font-bold leading-6 text-[#202635]">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 max-w-[390px] text-[13px] leading-6 text-[#2d3443]">
                      {benefit.text}
                    </p>
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f7f7f7] pb-16">
          <div className="grid gap-7 px-4 pt-4 md:grid-cols-2 md:px-10">
            {galleryImages.map((image) => (
              <div
                key={image.alt}
                className="h-[294px] overflow-hidden rounded-[7px] bg-[#d9d9d9]"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={900}
                  height={520}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>

          <div className="mt-20 bg-white px-8 pb-16 pt-20 md:px-12">
            <div className="text-center">
              <h2 className="mx-auto max-w-[460px] text-[30px] font-extrabold leading-[1.35] tracking-tight text-[#4d6688] md:text-[31px]">
                Trusted by Lakhs of
                <br />
                Happy Customer
              </h2>
              <p className="mx-auto mt-7 max-w-[560px] text-[16px] leading-[1.45] text-[#2d3443]">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed
                <br className="hidden md:block" />
                do eiusmod tempor incididunt ut lab
              </p>
            </div>

            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={`${testimonial.name}-${testimonial.place}`}
                  {...testimonial}
                />
              ))}
            </div>
          </div>
        </section>

        <footer className="bg-[#c91cff] px-5 pb-12 pt-14 text-[#121827] sm:px-8 md:px-12 md:pt-18">
          <div className="mx-auto max-w-[1000px]">
            <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div>
                <h2 className="text-[36px] font-medium leading-none tracking-tight sm:text-[45px]">
                  Stitch
                </h2>
                <p className="mt-6 max-w-[300px] text-sm leading-5">
                  We aim to revolutionize urban travel with fast, reliable, and
                  eco-friendly rides.
                </p>

                <div className="mt-7 flex items-center gap-5 pl-14 md:pl-14">
                  {["◎", "f", "X"].map((item) => (
                    <a
                      key={item}
                      href="#"
                      aria-label={`Social link ${item}`}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#202635] text-[12px] font-bold text-white"
                    >
                      {item}
                    </a>
                  ))}
                </div>

                <a
                  href="#"
                  className="mt-8 ml-[118px] inline-flex h-[25px] w-[86px] items-center justify-center rounded-[3px] bg-black text-[9px] font-semibold leading-none text-white"
                >
                  App Store
                </a>
              </div>

              {footerColumns.map((column) => (
                <div key={column.title}>
                  <h3 className="text-[17px] font-bold">{column.title}</h3>
                  <ul className="mt-8 space-y-6 text-sm">
                    {column.links.map((link) => (
                      <li key={link}>
                        <a href="#">{link}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-6 border-t border-[#d22dff] pt-8 text-sm md:flex-row md:items-center md:justify-between">
              <p>
                ©
                <a href="#" className="">
                  2026 Stitch.{" "}
                </a>{" "}
                All rights reserved
              </p>
              <div className="flex flex-wrap gap-10 md:gap-16">
                <a href="#">Privacy & Policy</a>
                <a href="#">Terms & Condition</a>
              </div>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}

function Connector({ className }: { className: string }) {
  return (
    <svg
      className={`pointer-events-none absolute hidden h-[74px] w-[290px] md:block ${className}`}
      viewBox="0 0 290 74"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 52C74 70 96 40 139 17C184 -8 231 6 290 13"
        stroke="#1f2634"
        strokeWidth="1"
      />
    </svg>
  );
}

function ServiceCard({
  title,
  image,
  className,
}: {
  title: string;
  image: string;
  className: string;
}) {
  return (
    <article className={`flex flex-col items-center ${className}`}>
      <div className="h-[214px] w-full max-w-[320px] border-r-[7px] border-t-[2px] border-[#232323] bg-[#d9d9d9]">
        <Image
          src={image}
          alt={title || "Tailoring service materials"}
          width={640}
          height={428}
          className="h-full w-full object-cover"
        />
      </div>
      {title ? (
        <h3 className="mt-6 text-center text-[36px] font-normal leading-none tracking-tight text-[#202635]">
          {title}
        </h3>
      ) : null}
    </article>
  );
}

function BenefitIcon({ icon }: { icon: string }) {
  if (icon === "phone") {
    return (
      <span className="h-5 w-5 rounded-[4px] border-[4px] border-[#111827] border-t-0 before:block before:h-2 before:w-2 before:translate-x-1 before:-translate-y-1 before:rounded-full before:bg-[#111827]" />
    );
  }

  if (icon === "tag") {
    return (
      <span className="relative h-5 w-5 rotate-45 rounded-[3px] border-[3px] border-[#111827] before:absolute before:left-1 before:top-1 before:h-[5px] before:w-[5px] before:rounded-full before:bg-[#111827]" />
    );
  }

  return (
    <span className="relative h-6 w-5 rounded-t-full rounded-bl-full bg-[#111827] after:absolute after:left-[7px] after:top-[7px] after:h-2 after:w-2 after:rounded-full after:bg-[#c322f4]" />
  );
}

function TestimonialCard({
  name,
  place,
  text,
  rating,
}: {
  name: string;
  place: string;
  text: string;
  rating: string;
}) {
  return (
    <article className="min-h-[160px] rounded-[7px] bg-[#242931] px-6 py-6 text-white">
      <div className="flex items-start justify-between gap-5">
        <div className="flex items-center gap-5">
          <span className="h-9 w-9 rounded-full bg-[#e8edf3]" />
          <span>
            <h3 className="text-[15px] font-bold leading-5">{name}</h3>
            <p className="text-[11px] leading-4">{place}</p>
          </span>
        </div>
        <span className="pt-2 text-xs font-bold text-[#f4d23d]">{rating}</span>
      </div>
      <p className="mt-7 text-[13px] leading-6 text-white">{text}</p>
    </article>
  );
}

function StepIcon({ icon }: { icon: string }) {
  if (icon === "pin") {
    return (
      <span className="relative z-10 h-10 w-8 rounded-t-full rounded-bl-full bg-[#111827] after:absolute after:left-[10px] after:top-[9px] after:h-3 after:w-3 after:rounded-full after:bg-[#c322f4]" />
    );
  }

  if (icon === "flag") {
    return (
      <span className="relative z-10 h-12 w-10 border-l-[5px] border-[#111827]">
        <span className="absolute left-0 top-0 h-7 w-9 rounded-r-full bg-[#111827]" />
      </span>
    );
  }

  return (
    <span className="relative z-10 h-10 w-10 rounded-full border-[5px] border-[#111827] after:absolute after:-bottom-2 after:-right-2 after:h-5 after:w-[5px] after:-rotate-45 after:rounded-full after:bg-[#111827]">
      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#111827]" />
    </span>
  );
}
