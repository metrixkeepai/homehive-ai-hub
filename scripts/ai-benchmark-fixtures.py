"""Generate synthetic, labelled test inputs. No customer media or external requests."""
import json
import pathlib
import subprocess
import sys
import wave
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from random import Random

out=pathlib.Path(sys.argv[1])
out.mkdir(parents=True,exist_ok=True)
records=[]
for kind,body,sections,facts in [
 ("invoice","Invoice MK-401. Acme Home Ltd. 18 March 2026. One Bosch kettle TWK7203, GBP 65.00. Total GBP 65.00.",["documents","assets"],["TWK7203","65"]),
 ("multi-item invoice","Invoice MX-225 from Maple Appliances dated 18 March 2026. To Alex Bell, 14 Elm Grove. Line 1 Bosch kettle TWK7203 GBP 65. Line 2 Dyson fan AM07 GBP 199. Line 3 repair labour for Dyson fan GBP 35. Total GBP 299. The kettle includes a 24-month warranty.",["documents","assets","maintenance","warranties"],["TWK7203","AM07","299"]),
 ("tenancy","Tenancy Agreement. Landlord Larch Homes. Tenant Alex Bell. 14 Elm Grove. Start 1 March 2026. Fixed term 12 months. Monthly rent GBP 1200. Tenant must give 60 days notice. Reference LT-77.",["documents","renewals"],["LT-77","1200","60"]),
 ("contract","Service agreement SC-118 with Elm Heating for annual boiler maintenance at 10 Oak Lane. Starts 1 April 2026. Ends 31 March 2027. Renews annually unless cancelled with 90 days notice. Annual fee GBP 180.",["documents","renewals"],["SC-118","90","180"]),
 ("warranty","Warranty certificate WX-811. Bosch kettle model TWK7203, purchased 18 March 2026 for GBP 65. Covered for 24 months by Elm Appliances.",["warranties"],["TWK7203","24"]),
 ("insurance","Home Insurance Policy IN-004. Insurer Birch Cover. Insured property 14 Elm Grove. Cover from 1 January 2026 to 31 December 2026. Annual premium GBP 320.",["documents","renewals"],["IN-004","320"]),
]:
 records.append(dict(kind=kind,fn="extractRecords",data=dict(mode="Upload document",text=body),sections=sections,facts=facts))
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",30)
receipt=Image.new("RGB",(780,350),"white")
ImageDraw.Draw(receipt).multiline_text((30,24),"ELM APPLIANCES\nReceipt MK-508\n18 March 2026\nBosch kettle TWK7203  GBP 65.00\nTotal GBP 65.00\nWarranty 24 months",font=font,fill="black",spacing=8)
for kind,im in [("clear receipt",receipt),("poor receipt",receipt.rotate(2,fillcolor="white").filter(ImageFilter.GaussianBlur(1.3)))]:
 name=kind.replace(" ","-")+".jpg";im.save(out/name,quality=65)
 records.append(dict(kind=kind,fn="extractRecords",data=dict(mode="Scan receipt"),file=name,sections=["assets","documents"],facts=["TWK7203","65"]))
for kind,path,facts in [("product photograph","src/assets/passport-tv.jpg",["television|tv"]),("room photograph","src/assets/auth-home.jpg",["chair|armchair","table"])]:
 records.append(dict(kind=kind,fn="extractRecords",data=dict(mode="Scan room" if "room" in kind else "Take photo"),file=str(pathlib.Path(path).resolve()),sections=["assets"],facts=facts))
records.append(dict(kind="Sera",fn="askSera",data=dict(messages=[dict(role="user",content="What model is my harbour kettle?")]),facts=["TWK7203"]))
voices=[
 ("en","I bought a Bosch kettle for sixty five pounds on March eighteenth. The model is T W K seven two zero three."),
 ("fr","J’ai acheté une bouilloire Bosch pour soixante-cinq livres le dix-huit mars. Mon adresse est quatorze rue Victor Hugo."),
 ("ar","اشتريت غلاية بوش بخمسة وستين جنيها في الثامن عشر من مارس."),
 ("hi","मैंने अठारह मार्च को पैंसठ पाउंड में बॉश की केतली खरीदी।"),
 ("ml","മാർച്ച് പതിനെട്ടിന് അറുപത്തിയഞ്ച് പൗണ്ടിന് ഞാൻ ഒരു ബോഷ് കെറ്റിൽ വാങ്ങി.")
]
for lang,script in voices:
 raw=out/(lang+"-raw.wav")
 subprocess.run(["espeak-ng","-v",lang,"-s","145","-w",str(raw),script],check=True)
 pcm=subprocess.check_output(["ffmpeg","-v","error","-i",str(raw),"-ar","16000","-ac","1","-f","s16le","-"])
 file=out/(lang+".wav")
 with wave.open(str(file),"wb") as w:
  w.setparams((1,2,16000,0,"NONE","not compressed"));w.writeframes(pcm)
 records.append(dict(kind="speech-"+lang,fn="transcribeToEnglish",audio=file.name,script=script,language=lang,data=dict(mime="audio/wav"),facts=["kettle","65|sixty.five"]))
(out/"cases.json").write_text(json.dumps(records))
