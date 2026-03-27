# docker compose exec label-studio python -c "
# import django, os
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.label-studio')
# django.setup()
# from users.models import User
# from organizations.models import Organization, OrganizationMember
# org = Organization.objects.first()
# for email, password, name in [('anotator.absa2@gmail.com','AkunAbsa@2','Annotator 2'),('anotator.absa3@gmail.com','AkunAbsa@3','Annotator 3')]:
#     if not User.objects.filter(email=email).exists():
#         u = User.objects.create_user(email=email, password=password, username=email)
#         u.first_name = name
#         u.save()
#         OrganizationMember.objects.get_or_create(user=u, organization=org)
#         print('Berhasil:', email)
#     else:
#         print('Sudah ada:', email)
# "