'use client'
import React from 'react'
import Link from "next/link";
import {Button} from "@/components/ComponentsProvider";
import {HandHelping, MoveLeft} from "lucide-react";
import {useRouter} from "next/navigation";

const Page = () => {
    const router = useRouter();

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 leading-relaxed">
            <h1 className="text-2xl font-bold mb-6">1. Introduction</h1>

            <p className="mb-4">
                Welcome to the Privacy Policy of <span className="font-semibold">«CarCar»</span>
            </p>

            <p className="mb-6">
                This Bot is intended exclusively for users in Poland and operates in accordance with Polish
                and European laws, including the <span className="font-medium">GDPR</span>
                (General Data Protection Regulation).
            </p>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-3">What does this bot do?</h2>
                <ul className="list-disc list-inside space-y-2">
                    <li>Uses a web application to process data.</li>
                    <li>Receives your Telegram data (user ID, name, username) and location (if you provide it).</li>
                    <li>Collects data about cars from public sources (without storing personal data of owners).</li>
                </ul>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-3">How do we use your data?</h2>
                <p className="mb-3">
                    Only for the operation of the Bot — your data is not shared with third parties and not used for
                    advertising.
                </p>
                <p className="mb-2">Location helps provide localized services (e.g., finding cars near you).</p>
                <p className="mb-2">Telegram data (ID, name) is required for identification and personalization.</p>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-3">Where is the data stored?</h2>
                <p className="mb-2">Servers are located in Europe (Amazon, Vercel), in compliance with GDPR
                    requirements.</p>
                <p>We do not transfer data outside the EU.</p>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-3">Important guarantees</h2>
                <ul className="list-disc list-inside space-y-2">
                    <li>✅ No selling of data — your information remains only in our application.</li>
                    <li>✅ Minimal collection — we request only what is necessary for the Bot to work.</li>
                    <li>✅ Right to deletion — you can request the deletion of your data.</li>
                </ul>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-3">Conclusion</h2>
                <p className="mb-4">
                    By continuing to use the Bot, you agree to this policy.
                </p>
                <div className={``}>
                    <p>If you have any questions: </p>
                    <div className={`grid grid-cols-2 gap-2 mt-2`}>
                        <Button variant={`default`}>
                            <Link className={`font-bold flex items-center gap-2`} href={`https://t.me/nookon`}> <HandHelping /> Support</Link>
                        </Button>
                        <Button onClick={() => router.back()} variant={`default`}>
                            <MoveLeft /> Back
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default Page
