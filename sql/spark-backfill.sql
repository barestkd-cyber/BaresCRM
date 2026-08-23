-- ===========================================================================
-- Spark backfill: fields the CRM has never had
-- ---------------------------------------------------------------------------
-- Source: Contact_Export_1.xls, 94 rows, one per student, exported 2026-08-22.
--
-- MATCHED ON spark_id ONLY. contacts already carries it for 94 people and it
-- lines up with the export exactly. No name matching: there are four "Race
-- Bares", two "Lea Na", two "Danny B" and two "Meredith White" in contacts,
-- and a name match would have merged them.
--
-- EVERY WRITE IS coalesce(existing, new). A column the CRM already knows is
-- left alone, so this can be re-run and can never overwrite current truth.
--
-- DELIBERATELY NOT IMPORTED:
--   belt ranks   - the export is stale. 68 of 92 disagree and the CRM holds
--                  the HIGHER rank in every case, because testing has
--                  happened since. Importing would demote 68 students.
--   last seen    - the export says 59 people are 180+ days gone; the CRM's
--                  own attendance says 73 were seen inside 180 days. The
--                  table with real check-ins in it wins.
--   age          - Birthday restated. It would be wrong within a year.
--   email        - the export's Email is the PARENT's, sitting on the
--                  student's row, and 13 of them are shared by siblings (33
--                  children). Writing those onto contacts would recreate the
--                  Emerson mix-up 94 times, and for the shared ones would
--                  break buyer resolution entirely. Parent contact details
--                  belong on guardian rows; that is a separate pass.
--
-- Addresses are normalised on the way in. "Whithouse" becomes Whitehouse and
-- casing is fixed. "Texas", "Tx" and "0" become TX, and where the state
-- column held a CITY with the city column blank, it is read as the city it
-- is. A missing state is settled from an East Texas zip rather than dropped.
-- One row has the house number in Address 1 and the street name in Address 2
-- ("307" + "Wichita Street"), joined with a space rather than a comma, since
-- a numbers-only first line is half a street and not a line of its own.
-- Three rows carry no address at all and contribute nothing.
-- ===========================================================================

begin;

update public.contacts set dob = coalesce(dob, '2009-01-21'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '8189157426'), address = coalesce(address, '307 Wichita Street Bullard, TX 75757'), entered_on = coalesce(entered_on, '2026-01-09'::date)
  where spark_id = '17669160';

update public.contacts set dob = coalesce(dob, '2021-04-20'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9034260782'), address = coalesce(address, '13443 Garden Lake Rd Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-10-15'::date)
  where spark_id = '17183173';

update public.contacts set dob = coalesce(dob, '2019-03-21'::date), phone = coalesce(phone, '3345240949'), address = coalesce(address, '1838 Rocky Mountain Lane Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-12-18'::date)
  where spark_id = '17590840';

update public.contacts set dob = coalesce(dob, '2019-05-26'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9032386139'), address = coalesce(address, '1211 Rainmaker Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-07-31'::date), kick_size = coalesce(kick_size, '7 - 7.5"')
  where spark_id = '16692770';

update public.contacts set dob = coalesce(dob, '2014-09-25'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9037482934'), address = coalesce(address, '13222 Timber Creek Dr Flint, TX 75762'), entered_on = coalesce(entered_on, '2026-04-01'::date)
  where spark_id = '18165039';

update public.contacts set dob = coalesce(dob, '2017-12-12'::date), phone = coalesce(phone, '9033434543'), address = coalesce(address, '105 Wendy Drive Tyler, TX 75791'), entered_on = coalesce(entered_on, '2024-02-16'::date), belt_size = coalesce(belt_size, '47" (3'' 11")'), kick_size = coalesce(kick_size, '7 - 7.5"')
  where spark_id = '14024817';

update public.contacts set dob = coalesce(dob, '2019-12-14'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '7704015688'), address = coalesce(address, '6866 Lazy Vale Ct. Suite 200 Tyler, TX 75703'), entered_on = coalesce(entered_on, '2026-06-02'::date)
  where spark_id = '18866203';

update public.contacts set dob = coalesce(dob, '2020-12-01'::date), phone = coalesce(phone, '9033434543'), address = coalesce(address, '105 Wendy Drive Tyler, TX 75791'), entered_on = coalesce(entered_on, '2024-02-16'::date), belt_size = coalesce(belt_size, '41" (3'' 5")')
  where spark_id = '14024816';

update public.contacts set dob = coalesce(dob, '2020-03-26'::date), phone = coalesce(phone, '7604032246'), address = coalesce(address, '202 Wendy Dr Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-08-30'::date)
  where spark_id = '16888583';

update public.contacts set dob = coalesce(dob, '2014-07-24'::date), phone = coalesce(phone, '9039207848'), address = coalesce(address, '17789 CR 1108 Flint, TX 75762'), entered_on = coalesce(entered_on, '2023-04-17'::date)
  where spark_id = '14024830';

update public.contacts set dob = coalesce(dob, '1969-06-01'::date), phone = coalesce(phone, '19033637573'), address = coalesce(address, '4044 Canyon Circle Tyler, TX 75706'), entered_on = coalesce(entered_on, '2014-09-30'::date)
  where spark_id = '14024877';

update public.contacts set dob = coalesce(dob, '2015-09-05'::date), phone = coalesce(phone, '3187309243'), address = coalesce(address, '6519 Rochester Way Tyler, TX 75703'), entered_on = coalesce(entered_on, '2023-08-09'::date), belt_size = coalesce(belt_size, '50" (4'' 2")')
  where spark_id = '14024834';

update public.contacts set dob = coalesce(dob, '2019-11-04'::date), phone = coalesce(phone, '7179770205'), address = coalesce(address, '11126 Westhaven Cir Flint, TX 75762'), entered_on = coalesce(entered_on, '2026-04-07'::date)
  where spark_id = '18551556';

update public.contacts set dob = coalesce(dob, '1990-09-11'::date), phone = coalesce(phone, '9034239609'), address = coalesce(address, '11965 Lakeway dr Tyler, TX 75704'), entered_on = coalesce(entered_on, '2025-03-09'::date)
  where spark_id = '15706550';

update public.contacts set dob = coalesce(dob, '2019-07-18'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9033604912'), address = coalesce(address, '11833 County Road 331 Tyler, TX 75708'), entered_on = coalesce(entered_on, '2024-10-01'::date)
  where spark_id = '14446136';

update public.contacts set dob = coalesce(dob, '2014-01-22'::date), phone = coalesce(phone, '5058704902'), address = coalesce(address, '8526 Auburn Tyler, TX 75703'), entered_on = coalesce(entered_on, '2021-07-08'::date), belt_size = coalesce(belt_size, '63" (5'' 3")')
  where spark_id = '14024856';

update public.contacts set dob = coalesce(dob, '2022-04-08'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '8149336517'), address = coalesce(address, '4052 Stonebridge Dr Tyler, TX 75707'), entered_on = coalesce(entered_on, '2025-10-08'::date)
  where spark_id = '17138181';

update public.contacts set dob = coalesce(dob, '2020-12-07'::date), phone = coalesce(phone, '2149094101'), address = coalesce(address, '2032 Balsam Gap Tyler, TX 75703'), entered_on = coalesce(entered_on, '2024-06-11'::date)
  where spark_id = '14024855';

update public.contacts set dob = coalesce(dob, '1962-08-21'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '2106161213'), address = coalesce(address, '6039 Pine Cone Ln Tyler, TX 75707'), entered_on = coalesce(entered_on, '2025-03-11'::date)
  where spark_id = '15719638';

update public.contacts set dob = coalesce(dob, '1981-02-21'::date), phone = coalesce(phone, '5125421756'), address = coalesce(address, '19117 Lakeshore Dr Tyler, TX 75703'), entered_on = coalesce(entered_on, '2026-01-31'::date)
  where spark_id = '17804505';

update public.contacts set dob = coalesce(dob, '2017-09-29'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9037055651'), address = coalesce(address, '7812 Hollytree Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-01-17'::date), kick_size = coalesce(kick_size, '8.125 - 8.625"')
  where spark_id = '15361905';

update public.contacts set dob = coalesce(dob, '1987-05-08'::date), phone = coalesce(phone, '9722158857'), address = coalesce(address, '2159 North Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2023-04-14'::date), belt_size = coalesce(belt_size, '56" (4'' 8")')
  where spark_id = '14024829';

update public.contacts set dob = coalesce(dob, '2017-08-06'::date), phone = coalesce(phone, '9034239609'), address = coalesce(address, '11965 Lakeway Dr Tyler, TX 75704'), entered_on = coalesce(entered_on, '2025-12-14'::date)
  where spark_id = '17538452';

update public.contacts set dob = coalesce(dob, '2021-01-27'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9039875469'), address = coalesce(address, '813 Jeffery Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-08-11'::date)
  where spark_id = '16757941';

update public.contacts set dob = coalesce(dob, '2010-07-15'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9037482934'), address = coalesce(address, '13222 Timber Creek Dr Flint, TX 75762'), entered_on = coalesce(entered_on, '2025-11-07'::date), kick_size = coalesce(kick_size, '9.5 - 10"')
  where spark_id = '17320226';

update public.contacts set dob = coalesce(dob, '2019-12-05'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9039207848'), entered_on = coalesce(entered_on, '2024-09-26'::date)
  where spark_id = '14404217';

update public.contacts set dob = coalesce(dob, '2021-07-13'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9032831834'), address = coalesce(address, '19321 Big Valley Dr Flint, TX 75762'), entered_on = coalesce(entered_on, '2025-08-15'::date)
  where spark_id = '16777896';

update public.contacts set dob = coalesce(dob, '1992-10-29'::date), phone = coalesce(phone, '9035213290'), address = coalesce(address, '105 Wendy drive Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-12-09'::date)
  where spark_id = '17511793';

update public.contacts set dob = coalesce(dob, '2004-08-03'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '4304441510'), address = coalesce(address, '1717 Shiloh rd apt 234 Tyler, TX 75703'), entered_on = coalesce(entered_on, '2026-05-04'::date)
  where spark_id = '18711940';

update public.contacts set dob = coalesce(dob, '2019-04-21'::date), phone = coalesce(phone, '9037215446'), address = coalesce(address, '11575 Laurel Oaks Cir Flint, TX 75762'), entered_on = coalesce(entered_on, '2022-05-30'::date), belt_size = coalesce(belt_size, '44" (3'' 8")')
  where spark_id = '14024809';

update public.contacts set dob = coalesce(dob, '2022-02-19'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9032844838'), address = coalesce(address, '468 redbud circle Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2026-05-29'::date)
  where spark_id = '18848823';

update public.contacts set dob = coalesce(dob, '2019-04-07'::date), phone = coalesce(phone, '9032450289'), address = coalesce(address, '2967 Salado Creek Dr Tyler, TX 75703'), entered_on = coalesce(entered_on, '2024-07-15'::date)
  where spark_id = '14024827';

update public.contacts set dob = coalesce(dob, '2014-07-17'::date), phone = coalesce(phone, '3186171953'), address = coalesce(address, '1530 Kensington Dr Tyler, TX 75703'), entered_on = coalesce(entered_on, '2024-03-05'::date)
  where spark_id = '14024865';

update public.contacts set dob = coalesce(dob, '2018-04-10'::date), phone = coalesce(phone, '9032830561'), address = coalesce(address, '15936 Farm to Market Road 2964 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2024-06-05'::date), kick_size = coalesce(kick_size, '7 - 7.5"')
  where spark_id = '14024852';

update public.contacts set dob = coalesce(dob, '2022-09-08'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '6504553048'), address = coalesce(address, '1528 Luann Lane Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-09-21'::date)
  where spark_id = '17034803';

update public.contacts set dob = coalesce(dob, '2015-03-16'::date), phone = coalesce(phone, '9035390513'), address = coalesce(address, '15962 CR 2191 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2020-08-10'::date)
  where spark_id = '14024854';

update public.contacts set dob = coalesce(dob, '2018-12-05'::date), phone = coalesce(phone, '9728396564'), address = coalesce(address, '2159 North Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2022-11-16'::date), belt_size = coalesce(belt_size, '47" (3'' 11")')
  where spark_id = '14024826';

update public.contacts set dob = coalesce(dob, '2022-04-20'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9037475744'), address = coalesce(address, '10603 County Road 2225 Tyler, TX 75707'), entered_on = coalesce(entered_on, '2025-07-01'::date), belt_size = coalesce(belt_size, '42" (3'' 6")')
  where spark_id = '16514403';

update public.contacts set dob = coalesce(dob, '2016-04-01'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9032386139'), address = coalesce(address, '1211 Rainmaker Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-06-26'::date), kick_size = coalesce(kick_size, '8.75 - 9.25"')
  where spark_id = '16486478';

update public.contacts set dob = coalesce(dob, '2005-04-22'::date), phone = coalesce(phone, '9033632007'), address = coalesce(address, '22925 Shell Shore Dr. Bullard, TX 75757'), entered_on = coalesce(entered_on, '2023-05-18'::date)
  where spark_id = '14024943';

update public.contacts set dob = coalesce(dob, '2010-02-11'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '2102752594'), address = coalesce(address, '518 Almarion Street Bullard, TX 75757'), entered_on = coalesce(entered_on, '2025-12-29'::date)
  where spark_id = '17621076';

update public.contacts set dob = coalesce(dob, '2015-12-08'::date), phone = coalesce(phone, '8177341019'), address = coalesce(address, '301 Fernwood Drive Nacogdoches, TX 75964'), entered_on = coalesce(entered_on, '2026-03-26'::date)
  where spark_id = '18133946';

update public.contacts set dob = coalesce(dob, '1987-10-29'::date), phone = coalesce(phone, '8178793882'), address = coalesce(address, '301 Fernwood Dr Nacogdoches, TX 75964'), entered_on = coalesce(entered_on, '2026-03-26'::date)
  where spark_id = '18134321';

update public.contacts set dob = coalesce(dob, '2019-11-05'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9035301145'), address = coalesce(address, '13695 eastside rd Tyler, TX 75707'), entered_on = coalesce(entered_on, '2024-09-17'::date), kick_size = coalesce(kick_size, '8.125 - 8.625"')
  where spark_id = '14332192';

update public.contacts set dob = coalesce(dob, '2020-05-18'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '4692269298'), address = coalesce(address, '420 county road 4702 Troup, TX 75789'), entered_on = coalesce(entered_on, '2024-11-17'::date)
  where spark_id = '14859190';

update public.contacts set dob = coalesce(dob, '1987-11-16'::date), phone = coalesce(phone, '9037215446'), address = coalesce(address, '11598 County Road 2210 Tyler, TX 75707'), entered_on = coalesce(entered_on, '2022-08-01'::date)
  where spark_id = '14024837';

update public.contacts set dob = coalesce(dob, '2016-06-03'::date), phone = coalesce(phone, '9039207848'), address = coalesce(address, '17789 CR 1108 Flint, TX 75762'), entered_on = coalesce(entered_on, '2025-05-27'::date), belt_size = coalesce(belt_size, '52" (4'' 4")')
  where spark_id = '16274485';

update public.contacts set dob = coalesce(dob, '2021-03-21'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9037523195'), address = coalesce(address, '1850 Walton Rd Tyler, TX 75701'), entered_on = coalesce(entered_on, '2024-11-21'::date)
  where spark_id = '14883052';

update public.contacts set dob = coalesce(dob, '2011-07-13'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '2242012002'), address = coalesce(address, '2201 Tweed Ct Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-08-07'::date), belt_size = coalesce(belt_size, '65" (5'' 5")')
  where spark_id = '16726924';

update public.contacts set dob = coalesce(dob, '1990-10-10'::date), phone = coalesce(phone, '9032458633'), address = coalesce(address, '104 Forest Creek Dr Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-12-10'::date)
  where spark_id = '17519003';

update public.contacts set phone = coalesce(phone, '9032830561'), address = coalesce(address, '15936 FM 2964 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2026-04-06'::date)
  where spark_id = '18549206';

update public.contacts set dob = coalesce(dob, '2016-05-05'::date), phone = coalesce(phone, '9032830561'), address = coalesce(address, '15936 FM 2964 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2024-06-05'::date), kick_size = coalesce(kick_size, '7 - 7.5"')
  where spark_id = '14024851';

update public.contacts set dob = coalesce(dob, '2015-03-04'::date), phone = coalesce(phone, '9032581328'), address = coalesce(address, '3698 Holly Lane, Terrebonne Flint, TX 75762'), entered_on = coalesce(entered_on, '2024-03-12'::date), belt_size = coalesce(belt_size, '58" (4'' 10")')
  where spark_id = '14024866';

update public.contacts set dob = coalesce(dob, '2016-01-31'::date), phone = coalesce(phone, '9037215446'), address = coalesce(address, '11575 Laurel Oaks Cir Tyler, TX 75703'), entered_on = coalesce(entered_on, '2022-05-30'::date), belt_size = coalesce(belt_size, '52" (4'' 4")')
  where spark_id = '14024810';

update public.contacts set dob = coalesce(dob, '2020-02-27'::date), phone = coalesce(phone, '9037475744'), address = coalesce(address, '10603 County Road 2225 Tyler, TX 75707'), entered_on = coalesce(entered_on, '2023-09-26'::date), belt_size = coalesce(belt_size, '49" (4'' 1")')
  where spark_id = '14024803';

update public.contacts set dob = coalesce(dob, '2016-04-08'::date), phone = coalesce(phone, '4303440229'), address = coalesce(address, '14820 County Road 2333 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-05-28'::date)
  where spark_id = '16287242';

update public.contacts set dob = coalesce(dob, '2021-10-02'::date), phone = coalesce(phone, '5125019967'), address = coalesce(address, '7335 Kingsport Ln Tyler, TX 75703'), entered_on = coalesce(entered_on, '2026-02-13'::date)
  where spark_id = '17909187';

update public.contacts set dob = coalesce(dob, '2013-04-08'::date), phone = coalesce(phone, '4303440229'), address = coalesce(address, '14820 County Road 2333 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-05-28'::date)
  where spark_id = '16287230';

update public.contacts set dob = coalesce(dob, '2014-09-22'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9363329661'), address = coalesce(address, '1001 Bobwhite Lane Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2024-09-17'::date)
  where spark_id = '14332232';

update public.contacts set dob = coalesce(dob, '2016-10-03'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '5863810186'), address = coalesce(address, '6109 Havens Trail Tyler, TX 75707'), entered_on = coalesce(entered_on, '2026-05-05'::date)
  where spark_id = '18717418';

update public.contacts set dob = coalesce(dob, '2007-05-01'::date), phone = coalesce(phone, '9039048118'), address = coalesce(address, 'PO BOX 968 Brownsboro, TX 75756'), entered_on = coalesce(entered_on, '2026-05-21'::date)
  where spark_id = '18820255';

update public.contacts set dob = coalesce(dob, '2012-08-24'::date), phone = coalesce(phone, '9033129735'), address = coalesce(address, '3102 Spruce Pl Tyler, TX 75707'), entered_on = coalesce(entered_on, '2023-02-23'::date)
  where spark_id = '14024825';

update public.contacts set dob = coalesce(dob, '2013-07-12'::date), phone = coalesce(phone, '19039202266'), address = coalesce(address, '2088 Yasmeen Circle Flint, TX 75762'), entered_on = coalesce(entered_on, '2018-04-18'::date)
  where spark_id = '14024842';

update public.contacts set dob = coalesce(dob, '2021-01-24'::date), phone = coalesce(phone, '9035219884'), address = coalesce(address, '1008 Beth Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2024-06-02'::date)
  where spark_id = '14024850';

update public.contacts set dob = coalesce(dob, '2022-03-14'::date), phone = coalesce(phone, '9037215446'), entered_on = coalesce(entered_on, '2025-06-04'::date)
  where spark_id = '16339887';

update public.contacts set dob = coalesce(dob, '2023-01-19'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9035219884'), address = coalesce(address, '1008 Beth Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-10-11'::date)
  where spark_id = '17155479';

update public.contacts set dob = coalesce(dob, '2018-04-12'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '3185780896'), address = coalesce(address, '610 Barclay Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2024-09-17'::date), kick_size = coalesce(kick_size, '7.625 - 8"')
  where spark_id = '14332253';

update public.contacts set dob = coalesce(dob, '2022-04-05'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9039446174'), address = coalesce(address, '6150 Rhones Quarter Road, 91B Tyler, TX 75707'), entered_on = coalesce(entered_on, '2025-04-18'::date)
  where spark_id = '15997502';

update public.contacts set dob = coalesce(dob, '2010-02-10'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9039522250'), entered_on = coalesce(entered_on, '2025-02-16'::date)
  where spark_id = '15562522';

update public.contacts set dob = coalesce(dob, '1995-02-27'::date), phone = coalesce(phone, '9035305441'), address = coalesce(address, '6602 Rollins Dr Tyler, TX 75703'), entered_on = coalesce(entered_on, '2019-01-30'::date), belt_size = coalesce(belt_size, '66" (5'' 6")')
  where spark_id = '14024841';

update public.contacts set dob = coalesce(dob, '2010-06-06'::date), phone = coalesce(phone, '9039207848'), address = coalesce(address, '17789 CR 1108 Flint, TX 75762'), entered_on = coalesce(entered_on, '2022-07-13'::date)
  where spark_id = '14024822';

update public.contacts set dob = coalesce(dob, '2021-09-20'::date), phone = coalesce(phone, '9036038510'), address = coalesce(address, '601 W Main St Bullard, TX 75757'), entered_on = coalesce(entered_on, '2025-10-01'::date)
  where spark_id = '17111476';

update public.contacts set dob = coalesce(dob, '2013-03-01'::date), phone = coalesce(phone, '9037383295'), address = coalesce(address, 'PO Box 160 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2024-02-20'::date)
  where spark_id = '14024820';

update public.contacts set dob = coalesce(dob, '2018-03-20'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9033301510'), address = coalesce(address, '504 Quail Lane Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-01-07'::date), kick_size = coalesce(kick_size, '7 - 7.5"')
  where spark_id = '15255632';

update public.contacts set dob = coalesce(dob, '2010-03-19'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9037059424'), address = coalesce(address, '2525 Shiloh Rd #162 Tyler, TX 75703'), entered_on = coalesce(entered_on, '2025-01-29'::date), belt_size = coalesce(belt_size, '62" (5'' 2")')
  where spark_id = '15444115';

update public.contacts set dob = coalesce(dob, '2017-03-20'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9038063033'), address = coalesce(address, '2566 Barton Creek Circle Tyler, TX 75703'), entered_on = coalesce(entered_on, '2026-02-14'::date)
  where spark_id = '17909770';

update public.contacts set dob = coalesce(dob, '2021-01-18'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9035396357'), address = coalesce(address, '4366 Lazy Creek Dr. Tyler, TX 75707'), entered_on = coalesce(entered_on, '2025-04-19'::date)
  where spark_id = '16005222';

update public.contacts set dob = coalesce(dob, '2017-06-07'::date), phone = coalesce(phone, '9728396564'), address = coalesce(address, '2159 North Dr. Tyler, TX 75703'), entered_on = coalesce(entered_on, '2023-09-28'::date), belt_size = coalesce(belt_size, '47" (3'' 11")')
  where spark_id = '14024805';

update public.contacts set dob = coalesce(dob, '2022-04-20'::date), gender = coalesce(gender, 'Female'), phone = coalesce(phone, '9037475744'), address = coalesce(address, '10603 County Road 2225 Tyler, TX 75707'), entered_on = coalesce(entered_on, '2025-07-01'::date), belt_size = coalesce(belt_size, '41" (3'' 5")')
  where spark_id = '16514407';

update public.contacts set dob = coalesce(dob, '1983-04-13'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9037475744'), address = coalesce(address, '10603 County Road 2225 Tyler, TX 75707'), entered_on = coalesce(entered_on, '2025-12-09'::date), belt_size = coalesce(belt_size, '72" (6'')')
  where spark_id = '17511223';

update public.contacts set dob = coalesce(dob, '2015-07-28'::date), phone = coalesce(phone, '9033160965'), address = coalesce(address, '16224 CR 1104 Flint, TX 75762'), entered_on = coalesce(entered_on, '2023-09-18'::date)
  where spark_id = '14024801';

update public.contacts set dob = coalesce(dob, '1972-10-28'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '4303440229'), address = coalesce(address, '14820 County Road 2333 Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-12-09'::date)
  where spark_id = '17511361';

update public.contacts set dob = coalesce(dob, '1962-09-18'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '9032626608'), address = coalesce(address, '13611 Calvert Drive Troup, TX 75789'), entered_on = coalesce(entered_on, '2026-01-06'::date), kick_size = coalesce(kick_size, '11.5 - 12"')
  where spark_id = '17648196';

update public.contacts set dob = coalesce(dob, '1991-02-02'::date), phone = coalesce(phone, '9035218332'), address = coalesce(address, '104 Forest Creek Dr Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2025-12-10'::date)
  where spark_id = '17519015';

update public.contacts set dob = coalesce(dob, '2012-02-18'::date), phone = coalesce(phone, '9032453632'), address = coalesce(address, 'PO BOX 968 Brownsboro, TX 75756'), entered_on = coalesce(entered_on, '2024-02-02'::date), belt_size = coalesce(belt_size, '62" (5'' 2")'), kick_size = coalesce(kick_size, '8.75 - 9.25"')
  where spark_id = '14024813';

update public.contacts set dob = coalesce(dob, '2016-03-01'::date), phone = coalesce(phone, '2145371400'), address = coalesce(address, '331 Wilder Way Tyler, TX 75703'), entered_on = coalesce(entered_on, '2024-07-24'::date)
  where spark_id = '14024799';

update public.contacts set dob = coalesce(dob, '2019-08-10'::date), gender = coalesce(gender, 'Male'), phone = coalesce(phone, '3185780896'), address = coalesce(address, '610 Barclay Drive Tyler, TX 75703'), entered_on = coalesce(entered_on, '2024-09-17'::date), kick_size = coalesce(kick_size, '7 - 7.5"')
  where spark_id = '14332283';

update public.contacts set dob = coalesce(dob, '2015-07-09'::date), phone = coalesce(phone, '9035210694'), address = coalesce(address, '2045 Dressage Ln Tyler, TX 75703'), entered_on = coalesce(entered_on, '2021-07-19'::date), belt_size = coalesce(belt_size, '55" (4'' 7")')
  where spark_id = '14024840';

update public.contacts set dob = coalesce(dob, '2012-01-07'::date), phone = coalesce(phone, '9039207848'), address = coalesce(address, '17789 CR 1108 Flint, TX 75762'), entered_on = coalesce(entered_on, '2020-11-10'::date)
  where spark_id = '14024859';

update public.contacts set dob = coalesce(dob, '2018-09-30'::date), phone = coalesce(phone, '9032458633'), address = coalesce(address, '104 Forest Creek Dr Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2023-05-30'::date), kick_size = coalesce(kick_size, '7 - 7.5"')
  where spark_id = '14024833';

update public.contacts set dob = coalesce(dob, '1993-08-17'::date), phone = coalesce(phone, '9035087369'), address = coalesce(address, '19321 Big Valley Dr Flint, TX 75762'), entered_on = coalesce(entered_on, '2026-01-15'::date)
  where spark_id = '17719123';

update public.contacts set dob = coalesce(dob, '2014-05-27'::date), phone = coalesce(phone, '9032458633'), address = coalesce(address, '104 Forest Creek Dr Whitehouse, TX 75791'), entered_on = coalesce(entered_on, '2023-10-17'::date), belt_size = coalesce(belt_size, '54" (4'' 6")'), kick_size = coalesce(kick_size, '8.75 - 9.25"')
  where spark_id = '14024808';

commit;

select count(*) filter (where dob is not null)        as dob,
       count(*) filter (where gender is not null)     as gender,
       count(*) filter (where phone is not null)      as phone,
       count(*) filter (where address is not null)    as address,
       count(*) filter (where entered_on is not null) as entered_on,
       count(*) filter (where belt_size is not null)  as belt_size,
       count(*) filter (where kick_size is not null)  as kick_size,
       count(*)                                       as of_total
from public.contacts where spark_id is not null;
