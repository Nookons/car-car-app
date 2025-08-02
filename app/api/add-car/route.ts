import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/pl';

dayjs.extend(customParseFormat);
dayjs.locale('pl');

export async function POST(request: NextRequest) {
    try {
        const car = await request.json();

        const {
            title,
            price,
            images,
            ad_link,
            fuel_type,
            engine_capacity,
            engine_power,
            body_type,
            gearbox,
            transmission,
            country_origin,
            mileage,
            registration,
            new_used,
            date_registration,
            registered,
            original_owner,
            no_accident,
            has_registration,
            service_record,
            map_url,
            location_text,
            lat,
            lng,
            attribute,
            description,
            post_date,
            colour_type,
            battery_type,
            number_engines,
            avg_consumption,
            battery_capacity,
            financial_option,
            electric_power_peak,
            brake_energy_recovery,
            damaged,
            seller_name,
            seller_type,
            brand,
            model,
            color,
            door_count,
            nr_seats,
            year,
            platform
        } = car;

        const parsedPrice = Number(String(price).replace(/\s/g, '')); // '59 900' -> 59900
        const parsedMileage = Number(String(mileage).replace(/[^\d]/g, '')); // '67 908 km' -> 67908

        const parsedDateRegistration = date_registration
            ? dayjs(date_registration, 'DD MMMM YYYY', 'pl').isValid()
                ? dayjs(date_registration, 'DD MMMM YYYY', 'pl').format('YYYY-MM-DD')
                : null
            : null;


        const parse_registered = registered === "Tak";
        const parse_original_owner = original_owner === "Tak";
        const parse_no_accident = no_accident === "Tak";
        const parse_has_registration = has_registration === "Tak";
        const parse_service_record = service_record === "Tak";
        const parse_financial_option = financial_option === "Tak";
        const parse_damaged = damaged === "Tak";
        const parse_brake_energy_recovery = brake_energy_recovery === "Tak";


        const query = `
      INSERT INTO cars (
        title, price, images, fuel_type, engine_capacity, engine_power,
        body_type, gearbox, transmission, country_origin, mileage, registration,
        new_used, date_registration, registered, original_owner, no_accident,
        has_registration, service_record, map_url, location_text, lat, lng, geom,
        attribute, description, post_date, colour_type, battery_type,
        number_engines, avg_consumption, battery_capacity, financial_option,
        electric_power_peak, brake_energy_recovery, damaged, ad_link, seller_name, seller_type,   brand, model, color, door_count, nr_seats, year, platform
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23,
        ST_SetSRID(ST_MakePoint($24, $25), 4326)::GEOGRAPHY,
        $26, $27, $28, $29, $30,
        $31, $32, $33, $34,
        $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47
      )
      RETURNING id;
    `;

        const values = [
            title,
            parsedPrice,
            images,
            fuel_type,
            engine_capacity,
            engine_power,
            body_type,
            gearbox,
            transmission,
            country_origin,
            parsedMileage,
            registration,
            new_used,
            parsedDateRegistration,
            parse_registered,
            parse_original_owner,
            parse_no_accident,
            parse_has_registration,
            parse_service_record,
            map_url,
            location_text,
            lat,
            lng,
            lng, // geom: lng
            lat, // geom: lat
            attribute,
            description,
            post_date,
            colour_type,
            battery_type,
            number_engines,
            avg_consumption,
            battery_capacity,
            parse_financial_option,
            electric_power_peak,
            parse_brake_energy_recovery,
            parse_damaged,
            ad_link,
            seller_name,
            seller_type,
            brand,
            model,
            color,
            door_count,
            nr_seats,
            year,
            platform
        ];


        const result = await pool.query(query, values);
        const insertedId = result.rows[0]?.id;

        return NextResponse.json({ message: 'Inserted', id: insertedId }, { status: 201 });

    } catch (err: any) {
        console.error('❌ Database insert error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
