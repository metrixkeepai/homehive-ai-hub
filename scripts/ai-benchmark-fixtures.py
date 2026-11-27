"""Generate synthetic, labelled test inputs. No customer media or external requests."""
import json
import pathlib
import subprocess
import sys
import wave
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from random import Random
import array

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
receipt_ref=sys.argv[2] if len(sys.argv)>2 else "MK-508"
ImageDraw.Draw(receipt).multiline_text((30,24),f"ELM APPLIANCES\nReceipt {receipt_ref}\n18 March 2026\nBosch kettle TWK7203  GBP 65.00\nTotal GBP 65.00\nWarranty 24 months",font=font,fill="black",spacing=8)
for kind,im in [("clear receipt",receipt),("poor receipt",receipt.rotate(2,fillcolor="white").filter(ImageFilter.GaussianBlur(1.3)))]:
 name=kind.replace(" ","-")+".jpg";im.save(out/name,quality=65)
 records.append(dict(kind=kind,fn="extractRecords",data=dict(mode="Scan receipt"),file=name,sections=["assets","documents"],facts=["TWK7203","65"]))
receipt.save(out/"receipt.pdf","PDF",resolution=150.0)
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
 records.append(dict(kind="speech-"+lang,fn="transcribeToEnglish",audio=file.name,script=script,language=lang,data=dict(mime="audio/wav"),facts=["kettle","GBP 65"]))
# Keep genuine duplicate fixtures explicit in the results. Other variants change source facts.
source=list(records)
for case in source:
 if case["kind"]=="speech-en":
  noise=Random(1842)
  with wave.open(str(out/case["audio"]),"rb") as w:
   samples=array.array("h",w.readframes(w.getnframes()))
  with wave.open(str(out/"en-noisy.wav"),"wb") as w:
   w.setparams((1,2,16000,0,"NONE","not compressed"));w.writeframes(array.array("h",(max(-32768,min(32767,v+noise.randint(-350,350))) for v in samples)).tobytes())
  records.append(dict(case,kind="speech-en-noisy",audio="en-noisy.wav"))
for i in range(3):
 body=f"Receipt Q-{700+i}. Birch Appliances. 12 May 2026. One Acme lamp model LM-{100+i} for GBP {24+i}. Total GBP {24+i}."
 records.append(dict(kind=f"receipt variant {i+1}",fn="extractRecords",data=dict(mode="Scan receipt",text=body),sections=["assets","documents"],facts=[f"LM-{100+i}",str(24+i)]))
for i in range(9):
 body=f"Service agreement QA-{400+i}. Customer Elm Homes, supplier Cedar Heat. Annual boiler inspection. Starts 1 May 2026. Ends 30 April 2027. Annual fee GBP {150+i}. Cancel with {30+i} days notice."
 records.append(dict(kind=f"service contract {i+1}",fn="extractRecords",data=dict(mode="Upload document",text=body),sections=["documents","renewals"],facts=[f"QA-{400+i}",str(150+i),str(30+i)]))
for i in range(10):
 body=f"Warranty certificate WQ-{200+i}. Reed Electronics, item Acme monitor model VX-{300+i}. Purchased 1 April 2026. Warranty term 24 months. Price GBP {100+i}."
 records.append(dict(kind=f"warranty {i+1}",fn="extractRecords",data=dict(mode="Upload document",text=body),sections=["warranties"],facts=[f"VX-{300+i}","24"]))
for case in source[:11]:
 records.append(dict(case,kind=case["kind"]+" (repeat)",repeat=True))
(out/"cases.json").write_text(json.dumps(records))
